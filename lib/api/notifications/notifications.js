/**
 * @type get
 * @path /notifications
 */
async function _listNotifications(req, res, next) {
  this.logger.debug(`${this._traceStack()} - List notifications API called`);

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
  this.logger.debug(`${this._traceStack()} - Update notification API called`);

  const { notificationID } = req.params;

  let dbConnection;

  try {
    let query;
    if (notificationID === '0') {
      query = {};
    } else {
      // eslint-disable-next-line global-require
      const { ObjectID } = require('mongodb');
      query = { _id: ObjectID(notificationID) };
    }

    const body = { $set: { unRead: false } };

    dbConnection = await this._connectToDB();
    this.logger.trace(`${this._traceStack()} - Execute query`);
    const results = await dbConnection
      .db('alfred_push_notification')
      .collection('notificatons')
      .updateMany(query, body);

    // Send data back to caler
    if (results.result.nModified > 0) {
      this.logger.trace(
        `${this._traceStack()} - Updated notification: ${notificationID}`,
      );
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
    this.logger.trace(`${this._traceStack()} - Close DB connection`);
    await dbConnection.close();
  }
}

module.exports = {
  _listNotifications,
  _updateNotification,
};
