import App from './app';

import * as bodyParser from 'body-parser';
import loggerMiddleware from './middleware/logger';

import AddressController from './controllers/address/address.controller';

const app = new App({
    port: Number(process.env.PORT) || 4000,
    controllers: [new AddressController()],
    middleWares: [bodyParser.json(), bodyParser.urlencoded({ extended: true }), loggerMiddleware],
});

app.listen();
