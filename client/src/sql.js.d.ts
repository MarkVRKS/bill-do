declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): any[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }
  export interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(): any;
    free(): void;
  }
  export default function initSqlJs(config?: any): Promise<{
    Database: new (data?: ArrayLike<number>) => Database;
  }>;
}
