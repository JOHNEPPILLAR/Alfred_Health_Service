/**
 * Import external libraries
 */
const { Service } = require('alfred-base');

// Setup service options
const { version } = require('../../package.json');
const serviceName = require('../../package.json').description;
const namespace = require('../../package.json').name;

const options = {
  serviceName,
  namespace,
  serviceVersion: version,
};

// Bind api functions to base class
Object.assign(Service.prototype, require('../api/apn/apn'));
Object.assign(Service.prototype, require('../api/notifications/notifications'));

// Create base service
const service = new Service(options);

async function setupServer() {
  // Setup service
  await service.createRestifyServer();

  // Apply api routes
  service.restifyServer.put('/apn', (req, res, next) =>
    service._apn(req, res, next),
  );
  service.logger.trace(`${service._traceStack()} - Added '/apn' api`);

  service.restifyServer.get('/notifications', (req, res, next) =>
    service._listNotifications(req, res, next),
  );
  service.logger.trace(`${service._traceStack()} - Added '/notifications' api`);

  service.restifyServer.put(
    '/notifications/:notificationID',
    (req, res, next) => service._updateNotification(req, res, next),
  );
  service.logger.trace(
    `${service._traceStack()} - Added '/notifications/notificationID' api`,
  );

  // Listen for api requests
  service.listen();
}
setupServer();
