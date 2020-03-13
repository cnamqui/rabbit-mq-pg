import { Application, Request, Response, NextFunction } from 'express';
import express from 'express';

class App {
    public app: Application;
    public port: number;

    constructor(appInit: { port: number; middleWares: any; controllers: any }) {
        this.app = express();
        this.port = appInit.port;

        this.middlewares(appInit.middleWares);
        this.routes(appInit.controllers);
        this.assets();
        this.template();
        this.errorHandling();
    }

    private middlewares(middleWares: { forEach: (arg0: (middleWare: any) => void) => void }): void {
        middleWares.forEach(middleWare => {
            this.app.use(middleWare);
        });
    }

    private routes(controllers: { forEach: (arg0: (controller: any) => void) => void }): void {
        controllers.forEach(controller => {
            this.app.use('/', controller.router);
        });
    }

    private assets(): void {
        this.app.use(express.static('public'));
        this.app.use(express.static('views'));
    }

    private template(): void {
        this.app.set('view engine', 'ejs');
    }

    public errorHandling(): void {
        //An error handling middleware
        this.app.use(function(err: Error, req: Request, res: Response, next: NextFunction) {
            res.status(500);
            res.send(`An error has occured: \n ${err.stack}`);
            return next();
        });
    }

    public listen(): void {
        this.app.listen(this.port, () => {
            console.log(`App listening on the http://localhost:${this.port}`);
        });
    }
}

export default App;
