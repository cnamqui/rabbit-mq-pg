/* eslint-disable @typescript-eslint/no-explicit-any */
import amqp, { Channel, Connection, Message } from 'amqplib/callback_api';
import { v1 as uuid } from 'uuid';
import config from 'config';

// export interface PublishRequest{
//     routingKeyResult:
// }

export class MQServiceConnection {
    protected connUrl: string;
    constructor(protected channel: Channel) {
        this.connUrl = config.get<string>('mqServerConnectionOptions');
    }

    async publishToQueue(queueName: string, data: any): Promise<void> {
        if (this.channel) {
            await this.assertQueue(queueName);
            this.channel.sendToQueue(queueName, new Buffer(data), { persistent: true });
        } else {
            throw new Error('Channel is closed');
        }
    }

    async publishRequestAsyncResults(requestRoutingKey: string, payload: any): Promise<any> {
        if (this.channel) {
            const resultRoutingKey = uuid();
            const jsonPayload = JSON.stringify({ resultRoutingKey, payload });
            await this.assertExchange('work_exchange', 'direct', { durable: true });

            await this.assertExchange('result_exchange', 'direct', { durable: true });

            const resultQueue = await this.assertQueue('', { exclusive: true });
            console.log(`Waiting for result on queue ${resultQueue.queue}`);
            console.log(`With routing key ${resultRoutingKey}`);
            await this.bindQueue(resultQueue.queue, 'result_exchange', resultRoutingKey);
            return new Promise((resolve, reject) => {
                console.log(`Published message on work_exchange, with routing key ${requestRoutingKey}`);
                this.channel.publish('work_exchange', requestRoutingKey, Buffer.from(jsonPayload));
                setTimeout(() => {
                    reject('Timed Out');
                    //this.close();
                }, Number(config.get<string>('mqServiceTimeOut')) || 50000);
                this.getResults(resultQueue.queue)
                    .then(resolve)
                    .catch(reject);
            });
        }

        return Promise.resolve();
    }

    async publishRequest(requestRoutingKey: string, payload: any): Promise<any> {
        if (this.channel) {
            const resultRoutingKey = uuid();
            const jsonPayload = JSON.stringify({ resultRoutingKey, payload });
            await this.assertExchange('work_exchange', 'direct', { durable: true });
            if (this.channel.publish('work_exchange', requestRoutingKey, Buffer.from(jsonPayload))) {
                console.log(`Published message on work_exchange, with routing key ${requestRoutingKey}`);
            }
            return {
                exchange: 'result_exchange',
                routingKey: resultRoutingKey,
                requestPayload: payload,
            };
        }
        throw new Error('Channel is closed');
    }

    private async getResults(queueName: string): Promise<any> {
        return new Promise((resolve, reject) => {
            console.log(`Waiting for result on queue ${queueName}`);
            this.channel.consume(
                queueName,
                (msg: amqp.Message | null) => {
                    if (msg) {
                        console.log(`received result for request ID: ${msg.fields.routingKey}`);
                        const content = msg.content.toString();
                        resolve(content);
                        return content;
                    } else {
                        reject('No Results');
                        return;
                    }
                },
                { noAck: true },
            );
        });
    }

    private async bindQueue(queueName: string, exchangeName: string, routingKey: string, args?: any): Promise<void> {
        return new Promise((resolve, reject) => {
            this.channel.bindQueue(queueName, exchangeName, routingKey, args, err => {
                if (err) {
                    console.log(err);
                    reject(err);
                }
                resolve();
            });
        });
    }

    private async assertQueue(
        queueName?: string,
        options?: amqp.Options.AssertQueue,
    ): Promise<amqp.Replies.AssertQueue> {
        if (this.channel) {
            const _options = options || { durable: true };
            return new Promise((resolve, reject) => {
                this.channel.assertQueue(queueName, _options, (err: any, ok: amqp.Replies.AssertQueue) => {
                    if (!err) {
                        resolve(ok);
                        console.log(ok);
                    } else {
                        reject();
                    }
                });
            });
        }
        return Promise.reject();
    }
    private async assertExchange(
        exchangeName: string,
        type?: string,
        options?: amqp.Options.AssertExchange,
    ): Promise<void> {
        if (this.channel) {
            const _options: amqp.Options.AssertExchange = options || { durable: true };
            const _type = type || 'direct';
            return new Promise((resolve, reject) => {
                this.channel.assertExchange(
                    exchangeName,
                    _type,
                    _options,
                    (err: any, ok: amqp.Replies.AssertExchange) => {
                        if (!err) {
                            resolve();
                            console.log(ok);
                        } else {
                            reject();
                        }
                    },
                );
            });
        }
    }
    async close(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.channel) {
                this.channel.close(err => {
                    if (err) {
                        reject(err);
                        //console.log(err);
                    }
                    resolve();
                    console.log(`Closing rabbitmq channel`);
                });
            } else {
                resolve();
                console.log(`Rabbitmq channel already closed`);
            }
        });
    }
}
export class MQService {
    protected channel: Channel | undefined;
    async createConnection(): Promise<MQServiceConnection> {
        return new Promise((resolve, reject) => {
            const connUrl = config.get<string>('mqServerConnectionOptions');
            amqp.connect(connUrl, (err: any, conn: Connection) => {
                if (err) {
                    reject(err);
                } else {
                    conn.createChannel((err, channel: Channel) => {
                        resolve(new MQServiceConnection(channel));
                    });
                }
            });
            process.on('exit', code => {
                if (this.channel) {
                    this.channel.close((err: any) => {
                        // console.log(err);
                    });
                    console.log(`Closing rabbitmq channel`);
                }
            });
        });
    }
}
