const AWS = require('aws-sdk')
const {EC2} = require('./lib/ec2')
const ReservationManager = require('./lib/reservation_manager')

const ec2 = new EC2(new AWS.EC2({region: 'eu-west-1'}))

Promise
  .all([ec2.reservations(), ec2.instances()])
  .then(([reservations, instances]) => {
    const reservationMatcher = new ReservationManager(reservations)
    instances.forEach((instance) => {
      const reservation = reservationMatcher.consumeReservedCapacity(instance)
      if (reservation) {
        console.log(JSON.stringify(instance), '->', JSON.stringify(reservation))
      } else {
        console.log(JSON.stringify(instance))
      }
    })
    reservationMatcher.unusedReservedCapacity().forEach((reservation) => {
      console.log('->', JSON.stringify(reservation))
    })
  })
  .catch(e => console.error(e))
