import { ComponentResource, ComponentResourceOptions, Input } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface LoadBalancerArgs {
  domain: string,
  securityGroups: Input<string>[],
  subnets: Input<string>[]
  certificateArn: Input<string>
  targetGroupArn: Input<string>
}

export class LoadBalancer extends ComponentResource {
  public readonly loadBalancer: aws.lb.LoadBalancer;
  constructor(name: string, args: LoadBalancerArgs, opts?: ComponentResourceOptions) {
    super("custom:resource:LoadBalancer", name, {}, opts)

    // Create an Application Load Balancer
    this.loadBalancer = new aws.lb.LoadBalancer(`${name}-lb`, {
      name: `${name}-lb`,
      internal: false,
      loadBalancerType: "application",
      securityGroups: args.securityGroups,
      subnets: args.subnets,
      enableDeletionProtection: false,
      enableHttp2: true,
      tags: {
        Name: `${name}-lb`,
      },
    }, { parent: this });

    // Create the HTTPS listener using the ACM certificate ARN
    new aws.lb.Listener(`${name}-httpsListener`, {
      loadBalancerArn: this.loadBalancer.arn,
      port: 443,
      protocol: "HTTPS",
      sslPolicy: "ELBSecurityPolicy-2016-08", // You can adjust this SSL policy as needed
      certificateArn: args.certificateArn, // The ACM certificate ARN for the domain
      defaultActions: [
        {
          type: "forward",
          targetGroupArn: args.targetGroupArn
        },
      ],
    }, { parent: this.loadBalancer });

    // HTTP Listener (redirect HTTP to HTTPS)
    const httpListener = new aws.lb.Listener(`${name}-httpListener`, {
      loadBalancerArn: this.loadBalancer.arn,
      port: 80,
      protocol: "HTTP",
      defaultActions: [
        {
          type: "redirect",
          redirect: {
            protocol: "HTTPS",
            port: "443",
            statusCode: "HTTP_301",
          },
        },
      ],
    }, { parent: this.loadBalancer });



    // Redirect www to non-www
    new aws.lb.ListenerRule(`${name}-www-to-non-www`, {
      listenerArn: httpListener.arn, // HTTP listener
      priority: 100,
      conditions: [
        {
          hostHeader: {
            values: [`www.${args.domain}`],
          },
        },
      ],
      actions: [
        {
          type: "redirect",
          redirect: {
            host: args.domain,
            protocol: "HTTPS",
            port: "443",
            statusCode: "HTTP_301",
          },
        },
      ],
    }, { parent: this.loadBalancer });


    this.registerOutputs({
      ...this.loadBalancer.arn,
    })

  }
}
