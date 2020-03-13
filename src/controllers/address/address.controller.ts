/* eslint-disable @typescript-eslint/no-explicit-any */
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import ControllerBase from '../../interfaces/ControllerBase.interface';
import { MQService } from '../../services/mq-service';
import { v1 as uuid } from 'uuid';
import _ from 'lodash';

class AddressController implements ControllerBase {
    public path = '/address';
    public router = express.Router();

    constructor() {
        this.initRoutes();
    }

    public initRoutes(): void {
        this.router.post(this.path + '/check', this.checkAddressSync);
        this.router.get(this.path + '/check', this.testCheckAddressSync);
        this.router.post(this.path + '/check/async', this.checkAddressAsync);
        this.router.get(this.path + '/check/async', this.testCheckAddressAsync);
    }

    testCheckAddressSync = (req: Request, res: Response, next: NextFunction): void => {
        req.body = {
            addresses: ['google.com', 'facebook.com', 'boltoninternational.com'],
            services: ['geoip', 'ping'],
        };
        this.checkAddressSync(req, res, next);
    };

    checkAddressSync = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const mqSvc = new MQService();
        const { addresses, services } = req.body;
        let _services = ['ping', 'geoip'];
        if (services && services.length > 0) {
            _services = services;
        }
        const connection = await mqSvc.createConnection();

        const requestsForWork = addresses.map((addr: string) => {
            return Promise.all(
                _services.map((svc: string) => {
                    return connection
                        .publishRequestAsyncResults(svc, { address: addr })
                        .then(wr => {
                            const workerResult = JSON.parse(wr);
                            return workerResult;
                        })
                        .catch(e => {
                            return { service: svc, error: e };
                        });
                }),
            ).then(rs => {
                return { address: addr, results: rs };
            });
        });

        const result = await Promise.all(requestsForWork);
        try {
            await connection.close();
        } catch (e) {
            console.log(e);
        }
        res.status(200).json(result);
        next();
    };
    testCheckAddressAsync = (req: Request, res: Response, next: NextFunction): void => {
        req.body = {
            addresses: ['google.com', 'facebook.com', 'boltoninternational.com'],
            services: ['geoip', 'ping'],
        };
        this.checkAddressAsync(req, res, next);
    };
    checkAddressAsync = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const mqSvc = new MQService();
        const { addresses, services } = req.body;
        let _services = ['ping', 'geoip'];
        if (services && services.length > 0) {
            _services = services;
        }
        const connection = await mqSvc.createConnection();

        const requestsForWork = addresses.map((addr: string) => {
            return Promise.all(
                _services.map((svc: string) => {
                    return connection
                        .publishRequest(svc, { address: addr })
                        .then(rs => {
                            return { service: svc, results: rs };
                        })
                        .catch(e => {
                            return { service: svc, error: e };
                        });
                }),
            ).then(rs => {
                return { address: addr, results: rs };
            });
        });

        const result = await Promise.all(requestsForWork);
        try {
            await connection.close();
        } catch (e) {
            console.log(e);
        }
        res.status(200).json(result);
        next();
    };
}

export default AddressController;
