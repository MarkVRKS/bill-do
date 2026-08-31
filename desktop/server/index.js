const Fastify = require('fastify');
const cors = require('@fastify/cors');
const { initDb, closeDb } = require('./db.js');
const organizationRoutes = require('./routes/organizations.js');
const counterpartyRoutes = require('./routes/counterparties.js');
const invoiceRoutes = require('./routes/invoices.js');
const documentRoutes = require('./routes/documents.js');

let fastifyInstance = null;

async function startServer(dbPath, port, wasmPath) {
  await initDb(dbPath, wasmPath);
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
  app.get('/api/health', async () => ({ status: 'ok' }));

  // Friendly validation error handler
  app.setErrorHandler((error, request, reply) => {
    if (error.name === 'ZodError' || error.code === 'FST_ERR_VALIDATION') {
      const issues = error.issues || error.validation || [];
      const fields = issues.map(i => {
        const path = i.path ? i.path.join('.') : '';
        const msg = i.message || 'некорректное значение';
        return path ? `${path}: ${msg}` : msg;
      });
      return reply.status(400).send({
        error: 'Заполните все обязательные поля',
        fields: fields.length > 0 ? fields : undefined,
      });
    }
    console.error('[Server Error]', error);
    return reply.status(500).send({ error: error.message || 'Внутренняя ошибка сервера' });
  });

  await app.register(organizationRoutes);
  await app.register(counterpartyRoutes);
  await app.register(documentRoutes);
  await app.register(invoiceRoutes);

  console.log('=== ROUTE TREE ===');
  console.log(app.printRoutes());
  console.log('=== END ROUTE TREE ===');

  await app.listen({ port, host: '127.0.0.1' });
  fastifyInstance = app;
}

function closeDbAndServer() {
  if (fastifyInstance) { fastifyInstance.close(); fastifyInstance = null; }
  closeDb();
}

module.exports = { startServer, closeDb: closeDbAndServer };
