const ReservationUsage = require('./lib/reservation_usage')

const reservationUsage = new ReservationUsage()

exports.handler = (event, context, callback) => {
  reservationUsage
    .processEvent(event)
    .then(response => callback(null, response))
    .catch(callback)
}
