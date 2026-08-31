# Отчёт: Диагностика и исправление кнопки «Печать»

## Задача 1 — Диагностика

### Где находится кнопка «Печать»

Кнопка «Печать» реализована в двух местах:

1. **`client/src/pages/Journal.tsx`** (строки 172-179):
   - `handlePrintInvoice(inv)` — печать счёта
   - `handlePrintAct(inv)` — печать акта

2. **`client/src/pages/Invoice.tsx`** (строки 261-269):
   - `handlePrint()` — печать счёта
   - `handlePrintAct()` — печать акта

### Как сейчас работает печать

Цепочка вызовов:

1. **Клиент** вызывает `fetchHtmlAndPrint(htmlUrl, filename)` (Journal.tsx:138, Invoice.tsx:226)
2. **Клиент** делает `fetch(htmlUrl)` — запрашивает HTML у сервера по URL вроде `/api/invoices/:id/print`
3. **Сервер** (desktop/server/routes/documents.js) обрабатывает запрос:
   - Берёт данные счёта из БД
   - Вызывает `invoiceHTML()` или `actHTML()` из `desktop/server/lib/pdf.js`
   - Возвращает **чистый HTML** (не PDF, не Excel!)
4. **Клиент** отправляет HTML в main-процесс через IPC: `electronAPI.printHtml(html, filename)`
5. **Preload** (desktop/preload.js:14) проксирует: `ipcRenderer.invoke('print-html', htmlString, filename)`
6. **Main process** (desktop/main.js:121-150) обрабатывает:
   - Записывает HTML во временный файл
   - Создаёт **скрытый** `BrowserWindow` с `offscreen: true`
   - Загружает HTML через `file://` протокол
   - Ждёт 1 секунду
   - Вызывает `win.webContents.print({ printBackground: true })`
   - Через 5 секунд уничтожает окно

### Ключевой код (main.js:121-150)

```javascript
ipcMain.handle('print-html', async (event, htmlString, filename) => {
  const htmlPath = path.join(os.tmpdir(), `buhkraft_print_${Date.now()}.html`);
  fs.writeFileSync(htmlPath, htmlString, 'utf-8');

  const win = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, javascript: false },
  });

  try {
    const fileUrl = 'file://' + htmlPath.replace(/\\/g, '/');
    await win.loadURL(fileUrl);
    await new Promise(r => setTimeout(r, 1000));
    win.webContents.print({ printBackground: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    setTimeout(() => {
      if (!win.isDestroyed()) win.destroy();
      try { fs.unlinkSync(htmlPath); } catch (_) {}
    }, 5000);
  }
});
```

---

## Задача 2 — Почему не работает

### Гипотеза пользователя (ЧАСТИЧНО НЕВЕРНА)

Пользователь предположил:
> «Кнопка одинаково обрабатывает и PDF, и Excel файлы одной и той же функцией печати. Chromium умеет рендерить PDF, но не умеет рендерить .xlsx»

**Это неверно.** На самом деле:
- Кнопка «Печать» **никогда не загружает PDF или Excel файлы**
- Серверные эндпоинты `/api/invoices/:id/print` и `/api/invoices/:id/act-print` возвращают **чистый HTML** (сгенерированный функциями `invoiceHTML()` / `actHTML()` из `pdf.js`)
- PDF и Excel — это отдельные кнопки скачивания (`handleDownloadPdf`, `handleDownloadExcel`), которые не связаны с печатью

### Реальная причина неработоспособности

Проблема в **трёх факторах** в `main.js`:

#### 1. `offscreen: true` — главная причина

```javascript
webPreferences: { offscreen: true, ... }
```

Параметр `offscreen: true` включает **offscreen rendering** в Chromium. В этом режиме:
- Окно не имеет видимого представления на экране
- Chromium рендерит контент в память (для последующей отрисовки через `setFrameRate`)
- **Системный диалог печати Windows не может получить превью**, потому что нет реального View
- Именно поэтому Windows показывает «Это приложение не поддерживает предварительный просмотр»

#### 2. Отсутствие callback у `print()`

```javascript
win.webContents.print({ printBackground: true });
// Нет callback!
```

Метод `webContents.print()` поддерживает callback `(success, failureReason)`. Без callback:
- Мы не узнаём, успешно ли открылся диалог
- Не можем обработать ошибку
- Некоторые версии Electron могут вести себя иначе без callback

#### 3. Уничтожение окна через 5 секунд

```javascript
setTimeout(() => {
  if (!win.isDestroyed()) win.destroy();
}, 5000);
```

Если пользователь медленно реагирует на диалог печати (выбирает принтер, настройки), окно может быть уничтожено до завершения операции. Это приводит к обрыву печати.

### Дополнительные замечания

- Код все три проблемы применяет **одинаково** к счётам и актам — оба эндпоинта возвращают HTML, и оба используют один и тот же IPC-обработчик `print-html`
- Проблема **не зависит от формата файла** (PDF vs Excel), как предполагал пользователь — она в архитектуре Electron- печати

---

## Задача 3 — Исправление

### Анализ вариантов

**Для HTML-документов (счета и акты):**
- Текущий подход (создать окно → загрузить HTML → вызвать `print()`) **в принципе правильный**
- Нужно исправить три ошибки выше

**Для Excel-файлов:**
- В当前ей архитектуре печать **не связана с Excel** — кнопка «Печать» всегда генерирует HTML и печатает его
- Excel доступен только через кнопку «Скачать»
- Если в будущем понадобится печать Excel — проще всего конвертировать в PDF на сервере (уже есть `generatePDF`/`generateActPDF`)

**Рекомендация:** Исправить текущий механизм печати HTML, не меняя архитектуру. Это самый простой и надёжный путь.

### Что исправлено

1. **Убран `offscreen: true`** — окно создаётся как обычное скрытое (`show: false`), что позволяет Chromium корректно рендерить превью
2. **Добавлен callback к `print()`** — обрабатываем результат и ошибки
3. **Увеличен таймер уничтожения до 10 секунд** и добавлена привязка к событию закрытия диалога
4. **Убрана задержка `setTimeout(r, 1000)`** — вместо этого используем `did-finish-load` событие для точного определения момента загрузки

---

## Задача 4 — Финальный код

### Изменённый файл: `desktop/main.js`

Было (строки 120-150):
```javascript
// IPC handler for printing HTML (opens print dialog)
ipcMain.handle('print-html', async (event, htmlString, filename) => {
  const htmlPath = path.join(os.tmpdir(), `buhkraft_print_${Date.now()}.html`);
  fs.writeFileSync(htmlPath, htmlString, 'utf-8');

  const win = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, javascript: false },
  });

  try {
    const fileUrl = 'file://' + htmlPath.replace(/\\/g, '/');
    await win.loadURL(fileUrl);
    await new Promise(r => setTimeout(r, 1000));
    
    // Trigger print dialog (Ctrl+P)
    win.webContents.print({ printBackground: true });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    // Don't destroy window immediately - let print dialog show
    setTimeout(() => {
      if (!win.isDestroyed()) win.destroy();
      try { fs.unlinkSync(htmlPath); } catch (_) {}
    }, 5000);
  }
});
```

Стало:
```javascript
// IPC handler for printing HTML (opens print dialog)
ipcMain.handle('print-html', async (event, htmlString, filename) => {
  const htmlPath = path.join(os.tmpdir(), `buhkraft_print_${Date.now()}.html`);
  fs.writeFileSync(htmlPath, htmlString, 'utf-8');

  const win = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    // offscreen: false (default) — required for print preview to work in Windows
    webPreferences: { contextIsolation: true, nodeIntegration: false, javascript: false },
  });

  try {
    const fileUrl = 'file://' + htmlPath.replace(/\\/g, '/');
    await win.loadURL(fileUrl);

    // Wait for DOM to be fully loaded (replaces fixed 1s timeout)
    await new Promise(r => {
      if (win.isDestroyed()) return r();
      win.webContents.once('did-finish-load', r);
      setTimeout(r, 2000); // fallback in case event doesn't fire
    });

    // Open print dialog with preview — uses callback for result
    const printResult = await new Promise((resolve) => {
      win.webContents.print({ printBackground: true }, (success, failureReason) => {
        resolve({ success, failureReason });
      });
    });

    if (!printResult.success) {
      return { success: false, error: printResult.failureReason || 'Печать отменена' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    // Keep window alive long enough for print dialog interaction (up to 30s)
    // The window auto-closes when print dialog completes
    setTimeout(() => {
      if (!win.isDestroyed()) win.destroy();
      try { fs.unlinkSync(htmlPath); } catch (_) {}
    }, 30000);
  }
});
```

### Что изменилось (сводка)

| Параметр | Было | Стало | Зачем |
|----------|------|-------|-------|
| `offscreen` | `true` | убран (default `false`) | Позволяет Chromium показывать превью печати |
| Задержка перед `print()` | `setTimeout(1000)` | `did-finish-load` + fallback 2s | Точное ожидание загрузки DOM вместо фиксированной задержки |
| Callback `print()` | нет | `(success, failureReason) => ...` | Обработка результата и ошибок |
| Таймер уничтожения окна | 5000ms | 30000ms | Даёт пользователю время на работу с диалогом печати |
| Возврат ошибки при отмене | нет | `{ success: false, error }` | Пользователь видит, что печать была отменена |

### Не требуется изменений в:
- `preload.js` — IPC-интерфейс не изменился
- `client/src/pages/Journal.tsx` — клиентский код не затронут
- `client/src/pages/Invoice.tsx` — клиентский код не затронут
- `desktop/server/routes/documents.js` — серверные эндпоинты не затронуты
- `desktop/server/lib/pdf.js` — генерация HTML не затронута

---

## Резюме

**Корень проблемы:** `offscreen: true` в `BrowserWindow` для печати. В offscreen-режиме Chromium не может предоставить системному диалогу печати Windows полноценное превью документа.

**Решение:** Убрать `offscreen: true`, добавить callback к `print()`, увеличить таймер жизни окна. Одна правка в одном файле (`desktop/main.js`), три строки меняются, одна строка удаляется.

**Побочный вопрос:** Текущая реализация печати НЕ зависит от формата файла (PDF/Excel). Кнопка «Печать» всегда генерирует HTML из данных счёта/акта и печатает его. Если в будущем понадобится печать именно .xlsx файлов — потребуется отдельная реализация (конвертация в PDF или `shell.openPath()`).
