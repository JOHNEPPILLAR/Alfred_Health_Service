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
 *     sucess: 'true'
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

/**
 * @api {get} /healthcheck
 * @apiName healthcheck
 * @apiGroup Root
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     sucess: 'true'
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

    if (results.rowCount === 0) {
      serviceHelper.log('trace', 'healthCheck', 'No active services running');
      serviceHelper.sendResponse(res, false, 'No active services running');
      next();
    }

    // Loop through services and call their health check end point
    let apiURL;
    let healthCheckData;

    // Filter results so that only active services are processed
    results = results.rows.filter(data => data.active);

    let loopCounter = results.length;
    results.forEach(async (serviceInfo) => {
      try {
        loopCounter -= 1;
        apiURL = `https://${serviceInfo.ip_address}:${serviceInfo.port}/ping?clientaccesskey=${process.env.ClientAccessKey}`;
        serviceHelper.log('trace', 'healthCheck', `Calling: ${apiURL}`);
        healthCheckData = await serviceHelper.callAlfredServiceGet(apiURL);

        // If error then service is no longer active
        if (healthCheckData instanceof Error) {
          serviceHelper.log('trace', 'healthCheck', 'Service is no longer active');

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
          } catch (err) {
            serviceHelper.log('trace', 'healthCheck', 'Data store connection already released');
          }
          if (results.rowCount === 0) {
            serviceHelper.log('trace', 'healthCheck', 'Failed to save data');
          }
        } else if (healthCheckData.body.sucess === 'true') {
          activeServices.push(healthCheckData.body.data);
          activeCount += 1;
        }

        apiURL = null;
        healthCheckData = null;

        if (loopCounter === 1) {
          const returnJSON = {
            activeCount,
            activeServices,
          };

          serviceHelper.sendResponse(res, true, returnJSON);
          next();
        }
      } catch (err) {
        serviceHelper.log('error', 'healthCheck', err);
        apiURL = null;
        healthCheckData = null;
      }
    });
  } catch (err) {
    serviceHelper.log('error', 'healthCheck', err);
    serviceHelper.sendResponse(res, false, err.message);
    next();
  }
}
skill.get('/healthcheck', healthCheck);

module.exports = skill;
