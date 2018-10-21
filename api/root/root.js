/**
 * Import external libraries
 */
const Skills = require('restify-router').Router;
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
 *     success: 'true'
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
  serviceHelper.log('trace', 'ping', 'Ping API called');

  const ackJSON = {
    service: process.env.ServiceName,
    reply: 'pong',
    cpu: serviceHelper.getCpuInfo(),
    mem: serviceHelper.getMemoryInfo(),
    os: serviceHelper.getOsInfo(),
    process: serviceHelper.getProcessInfo(),
  };

  serviceHelper.sendResponse(res, true, ackJSON);
  next();
}
skill.get('/ping', ping);
skill.get('/', ping);

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
  serviceHelper.log('trace', 'healthCheck', 'Health check API called');
  const activeServices = [];
  let activeCount = 0;
  let results;
  let dbClient;
  let SQL;

  try {
    SQL = 'SELECT last(service_name, time) as service_name, ip_address, port, last(active, time) as active FROM services GROUP BY ip_address, port';
    serviceHelper.log('trace', 'healthCheck', 'Connect to data store connection pool');
    dbClient = await global.logDataClient.connect(); // Connect to data store
    serviceHelper.log('trace', 'healthCheck', 'Get list of active services');
    results = await dbClient.query(SQL);
    serviceHelper.log('trace', 'healthCheck', 'Release the data store connection back to the pool');
    try {
      await dbClient.release(); // Return data store connection back to pool
    } catch (err) {
      serviceHelper.log('trace', 'healthCheck', 'Data store connection already released');
    }

    // Loop through services and call their health check end point
    let apiURL;
    let healthCheckData;

    // Filter results so that only active services are processed
    results = results.rows.filter(data => data.active);

    if (results.length === 0) {
      serviceHelper.log('trace', 'healthCheck', 'No active services running');
      serviceHelper.sendResponse(res, false, 'No active services running');
      next();
    }

    let loopCounter = results.length;
    results.forEach(async (serviceInfo) => {
      let ip = serviceInfo.ip_address;
      if (serviceInfo.ip_address.split('.')[1] === '20') ip = '192.168.1.7'; // *HACK* Redirect if docker subnet is from svr 2
      apiURL = `https://${ip}:${serviceInfo.port}/ping?clientaccesskey=${process.env.ClientAccessKey}`;
      serviceHelper.log('trace', 'healthCheck', `Calling: ${apiURL}`);
      try {
        healthCheckData = await serviceHelper.callAlfredServiceGet(apiURL);
      } catch (err) {
        serviceHelper.log('error', 'healthCheck', err.message);
      }
      serviceHelper.log('trace', 'healthCheck', `Returning status was an error: ${healthCheckData instanceof Error}`);

      if (healthCheckData instanceof Error) {
        serviceHelper.log('info', 'healthCheck', `Service: ${serviceInfo.service_name} being marked as not active`);

        SQL = 'INSERT INTO services (time, service_name, ip_address, port, active ) VALUES ($1, $2, $3, $4, false)';
        const SQLValues = [
          new Date(),
          serviceInfo.service_name,
          serviceInfo.ip_address,
          serviceInfo.port,
        ];

        serviceHelper.log('trace', 'healthCheck', 'Connect to data store connection pool');
        dbClient = await global.logDataClient.connect(); // Connect to data store
        serviceHelper.log('trace', 'healthCheck', 'Mark service as inactive');
        results = await dbClient.query(SQL, SQLValues);
        serviceHelper.log('trace', 'healthCheck', 'Release the data store connection back to the pool');
        try {
          await dbClient.release(); // Return data store connection back to pool
        } catch (error) {
          serviceHelper.log('trace', 'healthCheck', 'Data store connection already released');
        }
        if (results.rowCount === 0) {
          serviceHelper.log('trace', 'healthCheck', 'Failed to save data');
        }
      } else {
        serviceHelper.log('trace', 'healthCheck', `Service: ${serviceInfo.service_name} working ok`);
        activeServices.push(healthCheckData.data);
        activeCount += 1;
      }

      loopCounter -= 1;
      if (loopCounter === 0) {
        const returnJSON = {
          activeCount,
          activeServices,
        };
        serviceHelper.sendResponse(res, true, returnJSON);
        next();
      }
    });
  } catch (err) {
    serviceHelper.log('error', 'healthCheck', err);
    serviceHelper.sendResponse(res, false, err);
    next();
  }
}
skill.get('/healthcheck', healthCheck);

/**
 * @api {get} /reregister
 * @apiName reregister
 * @apiGroup Root
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     success: 'true'
 *     data: {
 *       success or filure return message
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
async function reRegister(req, res, next) {
  serviceHelper.log('trace', 'reRegister', 'reRegister API called');

  let returnMessage = 'Re-registered service';

  if (!serviceHelper.registerService()) returnMessage = 'Unable to re-register service';

  serviceHelper.log('trace', 'reRegister', returnMessage);
  serviceHelper.sendResponse(res, false, returnMessage);
  next();
}
skill.get('/reregister', reRegister);

module.exports = skill;
