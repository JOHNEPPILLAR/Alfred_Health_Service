/**
 * Import external libraries
 */
const Skills = require('restify-router').Router;
const elasticsearch = require('@elastic/elasticsearch');
const os = require('os');

/**
 * Import helper libraries
 */
const serviceHelper = require('../../lib/helper.js');

const skill = new Skills();

/**
 * @api {get} /ping
 * @apiName ping
 * @apiGroup Root
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     data: 'pong'
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 400 Bad Request
 *   {
 *     data: Error message
 *   }
 *
 */
function ping(req, res, next) {
  serviceHelper.log('trace', 'Ping API called');

  const ackJSON = {
    service: process.env.ServiceName,
    reply: 'pong',
  };

  if (process.env.Environment === 'production') {
    try {
      const client = new elasticsearch.Client({
        node: process.env.ElasticSearch,
      });

      const load = os.loadavg();
      const currentDate = new Date();
      const formatDate = currentDate.toISOString();

      client.index({
        index: 'health',
        type: 'health',
        body: {
          time: formatDate,
          hostname: os.hostname(),
          mem_free: os.freemem(),
          mem_total: os.totalmem(),
          mem_percent: (os.freemem() * 100) / os.totalmem(),
          cpu: Math.min(Math.floor((load[0] * 100) / os.cpus().length), 100),
        },
      });
      client.close();
    } catch (err) {
      serviceHelper.log('error', err.message);
    }
  }

  serviceHelper.sendResponse(res, true, ackJSON); // Send response back to caller
  next();
}
skill.get('/ping', ping);

/**
 * @api {get} /healthcheck
 * @apiName healthcheck
 * @apiGroup Root
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     success: 'true'
 *     data: {
 *       activeCount: 0
 *     }
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 400 Bad Request
 *   {
 *     data: Error message
 *   }
 *
 */
async function healthCheck(req, res, next) {
  serviceHelper.log('trace', 'Health check API called');

  const activeServices = [];

  let apiURL;
  let healthCheckData;
  let activeCount = 0;

  const servicesToPing = [
    {
      name: 'alfred_iot_battery_service',
      ip: 'alfred_iot_battery_service',
      port: 3978,
    },
    {
      name: 'alfred_flowercare_data_collector_service',
      ip: '192.168.1.7',
      port: 3978,
    },
    {
      name: 'alfred_hls_service',
      ip: '192.168.1.7',
      port: 3982,
    },
    {
      name: 'alfred_scheduler_service',
      ip: 'alfred_scheduler_service',
      port: 3978,
    },
    {
      name: 'alfred_lights_service',
      ip: 'alfred_lights_service',
      port: 3978,
    },
    {
      name: 'alfred_controller_service',
      ip: '192.168.1.4',
      port: 3981,
    },
    {
      name: 'alfred_netatmo_data_collector_service',
      ip: 'alfred_netatmo_data_collector_service',
      port: 3978,
    },
    {
      name: 'alfred_dyson_data_collector_service',
      ip: 'alfred_dyson_data_collector_service',
      port: 3978,
    },
  ];

  let counter = 0;
  servicesToPing.forEach(async (service) => {
    apiURL = `https://${service.ip}:${service.port}/ping?clientaccesskey=${
      process.env.ClientAccessKey
    }`;
    serviceHelper.log('trace', `Calling: ${apiURL}`);
    try {
      healthCheckData = await serviceHelper.callAlfredServiceGet(apiURL);
    } catch (err) {
      serviceHelper.log('error', err.message);
    }
    if (healthCheckData instanceof Error) {
      serviceHelper.log('error', `Ping service failed: ${service.name}`);
    } else {
      serviceHelper.log('trace', `Ping service ok: ${service.name}`);
      activeServices.push(healthCheckData.data);
      activeCount += 1;
    }
    counter += 1;
    if (counter === servicesToPing.length) {
      const returnJSON = {
        activeCount,
        activeServices,
      };
      serviceHelper.sendResponse(res, true, returnJSON);
      next();
    }
  });
}
skill.get('/healthcheck', healthCheck);

module.exports = skill;
