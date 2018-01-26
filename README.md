# AWS Reservation Usage

`aws-reservation-usage` helps you understand your AWS reserved instances usage. It lists the number of running instances of each instance family, and how many are reserved, how many can be reserved, and how much reserved capacity that is not currently used. It also lists the number of running spot and EMR instances.

It can be run on the command line or deployed as a Lambda function, and it can be used as a slash command in Slack.

## Usage

First install the dependencies, like this:

```shell
$ npm install
```

### From the command line

Make sure you have your AWS credentials configured so that the AWS SDK can pick them up, for example by setting the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables, and run:

```shell
$ node index.js eu-west-1
```

If you have the `AWS_DEFAULT_REGION` environment variable set you can skip the argument to the command.

You will get an output looking something like this:

```
      running       spot        emr   reserved reservable    surplus
c4        108         28         12         32         36          0
i3        336          0          0        400          0         64
t2         48          0          0         36         12          0
```

The numbers in the table are _normalized instance units_. The instances in a family are grouped together and their sizes are summed by counting a small instance as 1, a medium as 2, a large as 4, and so on. See ["How Reserved Instances Are Applied"](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/apply_ri.html) in the EC2 documentation for a table with the normalization factors for all sizes. The reason why normalized instance units are used is partly to avoid the table becoming very big when you have many different instance types, but primarily because regional reservations apply to all instances in a family regardless of size, so they can't be attributed only to one instance type.

The `running` column shows the total number of running instance units, both on demand and spot. The `spot` and `emr` columns show the subset of the running instance units that are spot instances and instances that are part of an EMR cluster. The `reserved` column shows the total number of reserved units. The `reservable` column shows the number of instance units that are reservable and not covered by a reservations. Finally the `surplus` column shows the number of reserved units that are currently not matched by a running, reservable instance.

To be counted as "reservable" an instance must be on demand, not already covered by a reservation, and not part of an EMR cluster. Spot instances are not covered by reservations, but instances in an EMR cluster are. However, most EMR clusters are batch jobs that don't run 24/7, so reserving them isn't effective.

The way to think about the `reservable` and `surplus` columns is that the former shows the maximum number of additional capacity you can reserve without risking waste, and the latter the reserved capacity you are currently wasting. If `surplus` is not zero you should take action and either exchange or convert reservations, or change the instance types of your running instances to better match your reservations. `reservable` should be low, but within a range that matches how much your usage varies over time. If both `reservable` and `surplus` are non-zero you most likely have reservations with capacity guarantees (i.e. reservations that only match a specific instance type in a specific availability zone) that don't match any running instance.

### As a Lambda function

`aws-reservation-usage` can be deployed as a Lambda function, and in this mode it will return a JSON document instead of a plain text table.

There are a multitude of ways and lots of different tools to deploy Lambda functions, you can create a SAM template, use the [Serverless](https://serverless.com/) tools, do it manually, and so on. To not lock you into a specific method this repo comes with a very bare bones deployment script that can update the code of an existing Lambda function. If you have a favourite tool you should probably use it instead.

Besides the usual IAM permissions the function will require a statement with this rule in order to list instances and reservations:

```json
{
  "Effect": "Allow",
  "Action": [
    "ec2:DescribeInstances",
    "ec2:DescribeReservedInstances"
  ],
  "Resource": "*"
}
```

To use the deployment script make sure you have configured [`awscli`](https://aws.amazon.com/cli/) and run:

```shell
$ ./bin/deploy aws-reservation-usage
```

The argument, `aws-reservation-usage`, is the name of an existing Lambda function, and this specific value is only a suggestion.

Once the code has been deployed you should be able to call it like this:

```shell
$ aws lambda invoke-function --function-name aws-reservation-usage output.json
$ cat output.json
```

This will output something like this:

```json
[
  {"family":"c4","running":108,"spot":28,"emr":12,"reserved":32,"reservable":36,"surplus":0},
  {"family":"i3","running":336,"spot":0,"emr":0,"reserved":400,"reservable":0,"surplus":64},
  {"family":"t2","running":48,"spot":0,"emr":0,"reserved":36,"reservable":12,"surplus":0}
]
```

See above for an explanation of what the properties mean.

### As a Slack slash command

To use `aws-reservation-usage` as a slash command in Slack you must first deploy it as a Lambda function, and then in addition deploy an API Gateway that proxies requests to the function.

You can find instructions on how to set up an API Gateway to proxy requests to Lambda in the Slack documentation: https://api.slack.com/tutorials/aws-lambda.

Once you have a gateway working you can create a new Slack app, add a new slash command and use the address to the gateway stage as the URL. You also need to create an environment variable for your Lambda function called `VERIFICATION_TOKEN` and set it to the verification token of your Slack application.

`aws-reservation-usage` will automatically detect when a request comes from Slack and format it's response as a Slack message. It will assume that any argument given to the slash command is the region to report on, but default to the region it is running in.

Depending on how many instances and reservations you have it can take a few seconds to list them all. Slack has a hard limit on 3 seconds before it displays an error message, and with a cold start `aws-reservation-usage` will often time out. It does cache internally (reservations for one hour and instances for five minutes), but Lambda will also spin down the container when it is not in use for a while, and it's often listing instances that takes the most time. If you get a timeout, running the slash command again in a few seconds will give you a response. There is a workaround for this that has not yet been implemented.

# Copyright

© 2018 Burt AB, see LICENSE.txt (BSD 3-Clause).
