/* eslint-disable @typescript-eslint/no-explicit-any */
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import ControllerBase from '../../interfaces/ControllerBase.interface';
import { MQService } from '../../services/mq-service';
import { v1 as uuid } from 'uuid';

class RabbitController implements ControllerBase {
    public path = '/rabbit';
    public router = express.Router();

    constructor() {
        this.initRoutes();
    }

    public initRoutes(): void {
        this.router.post(this.path + '/', this.index);
        this.router.get(this.path + '/', this.testRoute);
        this.router.post(this.path + '/getWork', this.sendWork);
        this.router.get(this.path + '/getWork', this.testWork);
        this.router.post(this.path + '/getWorkMultiple', this.sendWorkMultiple);
        this.router.get(this.path + '/getWorkMultiple', this.testWorkMultiple);
    }

    testRoute = (req: Request, res: Response, next: NextFunction): void => {
        req.body = {
            queueName: 'test_queue',
            payload: `${new Date()}`,
        };
        this.index(req, res, next);
    };

    testWork = (req: Request, res: Response, next: NextFunction): void => {
        req.body = {
            workerName: 'string_test',
            payload: {
                date: `${new Date()}`,
                uuid: uuid(),
            },
        };
        this.sendWork(req, res, next);
    };
    testWorkMultiple = (req: Request, res: Response, next: NextFunction): void => {
        req.body = {
            requests: [
                {
                    requestName: 'ONE',
                    workerName: 'string_test',
                    payload: {
                        date: `${new Date()}`,
                        uuid: uuid(),
                    },
                },
                {
                    requestName: 'TWO',
                    workerName: 'string_test',
                    payload: {
                        date: `${new Date()}`,
                        uuid: uuid(),
                    },
                },
                {
                    requestName: 'THREE',
                    workerName: 'string_test',
                    payload: {
                        date: `${new Date()}`,
                        uuid: uuid(),
                    },
                },
            ],
        };
        this.sendWorkMultiple(req, res, next);
    };

    index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const mqSvc = new MQService();
        const { queueName, payload } = req.body;
        const connection = await mqSvc.createConnection();
        await connection.publishToQueue(queueName, payload);
        await connection.close();
        res.status(200).send({ 'message-sent': true });
        next();
    };

    sendWork = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const mqSvc = new MQService();
        const { workerName, payload } = req.body;
        const connection = await mqSvc.createConnection();
        try {
            const jsonPayload = JSON.stringify(payload);
            const result = await connection.publishRequestAsyncResults(workerName, jsonPayload);
            await connection.close();
            const _result = JSON.parse(result);
            res.status(200).send(_result);
            next();
        } catch (e) {
            console.log(e);
            return next(e);
        }
    };
    sendWorkMultiple = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const mqSvc = new MQService();
        const { requests } = req.body;
        const connection = await mqSvc.createConnection();

        const requestsForWork = requests.map((rq: any) => {
            const { workerName, payload, requestName } = rq;
            console.log(requestName);
            const jsonPayload = JSON.stringify(payload);
            return connection
                .publishRequestAsyncResults(workerName, jsonPayload)
                .then(wr => {
                    const workerResult = JSON.parse(wr);
                    return {
                        requestName,
                        workerResult,
                    };
                })
                .catch(e => {
                    return { error: e };
                });
        });
        const result = await Promise.all(requestsForWork);
        try {
            await connection.close();
        } catch (e) {
            console.log(e);
            //return next(e);
        }
        //const _result = result.map((rs: any) => JSON.parse(rs));
        res.status(200).json(result);
        next();
    };
}

export default RabbitController;
