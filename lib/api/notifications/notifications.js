/**
 * Import external libraries
 */
const debug = require('debug')('Health:API_Notifications');

/**
 * @type get
 * @path /notifications
 */
async function _listNotifications(req, res, next) {
  debug(`List notifications API called`);

  try {
    let results = await this._getUnreadNotification();

    if (results.count === 0) results = [];

    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 200, results);
    } else {
      return results;
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
  }
  return true;
}

/**
 * @type put
 * @path /notifications/:notificationID
 */
async function _updateNotification(req, res, next) {
  debug(`Update notification API called`);

  const { notificationID } = req.params;

  let dbConnection;

  try {
    let query;
    if (notificationID === '0') {
      query = {};
    } else {
      // eslint-disable-next-line global-require
      const objID = this._getMongoObjectID(notificationID);
      query = { _id: objID };
    }

    const body = { $set: { unRead: false } };

    debug('Connect to DB');
    dbConnection = await this._connectToDB();
    debug(`Query DB`);
    const results = await dbConnection
      .db('alfred_push_notification')
      .collection('notificatons')
      .updateMany(query, body);

    // Send data back to caler
    if (results.result.nModified > 0) {
      debug(`Updated notification: ${notificationID}`);
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 200, { state: 'saved' });
      }
      return true;
    }

    if (typeof res !== 'undefined' && res !== null) {
      const err = new Error('Failed to save');
      this.logger.error(`${this._traceStack()} - ${err.message}`);
      this._sendResponse(res, next, 500, err);
      return err;
    }
    return true;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
    return err;
  } finally {
    debug(`Close DB connection`);
    await dbConnection.close();
  }
}

module.exports = {
  _listNotifications,
  _updateNotification,
};
