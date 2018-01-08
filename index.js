const ReservationUsage = require('./lib/reservation_usage')

const reservationUsage = new ReservationUsage()

exports.handler = (event, context, callback) => {
  reservationUsage
    .processEvent(event)
    .then(response => callback(null, response))
    .catch(callback)
}

if (process.env.AWS_EXECUTION_ENV == null) {
  const event = {
    requestContext: {},
    queryStringParameters: {region: process.argv[2]},
    headers: {Accept: 'text/plain'},
  }
  exports.handler(event, null, (error, result) => {
    if (error) {
      throw error
    } else {
      console.log(result.body)
    }
  })
}
