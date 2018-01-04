const AWS = require('aws-sdk')
const EC2 = require('./lib/ec2')
const ReservationManager = require('./lib/reservation_manager')

const ec2 = new EC2(new AWS.EC2({region: 'eu-west-1'}))

function summarizeByFamily(objs, property) {
  const summary = {}
  objs.forEach((instance) => {
    summary[instance.family] = (summary[instance.family] || 0) + instance[property]
  })
  return summary
}

function sortedKeys(...objs) {
  let keys = objs.reduce((keys, o) => keys.concat(Object.keys(o)), [])
  keys = new Set(keys)
  keys = [...keys].sort()
  return keys
}

function summarizeFindings(reservations, instances, unreservedInstances, surplusReservations) {
  const summaries = {
    running: summarizeByFamily(instances, 'units'),
    reserved: summarizeByFamily(reservations, 'units'),
    unreserved: summarizeByFamily(unreservedInstances, 'units'),
    surplus: summarizeByFamily(surplusReservations, 'remainingUnits'),
  }
  const families = sortedKeys(summaries.running, summaries.reserved)
  return families.map((family) => {
    const row = {family}
    for (let column in summaries) {
      row[column] = summaries[column][family] || 0
    }
    return row
  })
}

function matchReservations(reservations, instances) {
  const reservationManager = new ReservationManager(reservations)
  const unreservedInstances = []
  instances.forEach((instance) => {
    const reservation = reservationManager.consumeReservedCapacity(instance)
    if (reservation == null) {
      unreservedInstances.push(instance)
      console.log(JSON.stringify(instance))
    } else {
      console.log(JSON.stringify(instance), '->', JSON.stringify(reservation))
    }
  })
  reservationManager.unusedReservedCapacity().forEach((reservation) => {
    console.log('->', JSON.stringify(reservation))
  })
  return summarizeFindings(reservations, instances, unreservedInstances, reservationManager.unusedReservedCapacity())
}

function leftPad(str, pad, n) {
  let padding = ''
  for (let i = 0; i < Math.max(0, n - str.length); i++) {
    padding += pad
  }
  return padding + str
}

function report(summary) {
  console.log('       running   reserved unreserved    surplus')
  for (let row of summary) {
    let line = row.family + ' '
    line += ' ' + leftPad(row.running.toString(), ' ', 10)
    line += ' ' + leftPad(row.reserved.toString(), ' ', 10)
    line += ' ' + leftPad(row.unreserved.toString(), ' ', 10)
    line += ' ' + leftPad(row.surplus.toString(), ' ', 10)
    console.log(line)
  }
}

Promise
  .all([ec2.loadReservations(), ec2.loadInstances()])
  .then(([reservations, instances]) => matchReservations(reservations, instances))
  .then(summary => report(summary))
  .catch(e => console.error(e))
