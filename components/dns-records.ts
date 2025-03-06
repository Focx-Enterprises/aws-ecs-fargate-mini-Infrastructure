import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface DnsRecordArgs {
  domain: string;
  zoneId: pulumi.Input<string>;
  albDnsName: pulumi.Input<string>;
  albZoneId: pulumi.Input<string>;
}

export class DnsRecords extends pulumi.ComponentResource {
  constructor(name: string, args: DnsRecordArgs, opts?: pulumi.ComponentResourceOptions) {
    super("custom:resource:DnsRecords", name, {}, opts);

    const { domain, zoneId, albDnsName, albZoneId } = args;

    // ✅ Route main domain (WordPress) to ALB
    new aws.route53.Record(`${name}-${domain}-record-a`, {
      zoneId: zoneId,
      name: domain,
      type: "A",
      aliases: [{
        name: albDnsName,
        zoneId: albZoneId,
        evaluateTargetHealth: true,
      }],
    }, { parent: this });

    // ✅ Route 'www.domain.com' to ALB
    new aws.route53.Record(`${name}-www-${domain}-record-a`, {
      zoneId: zoneId,
      name: `www.${domain}`,
      type: "A",
      aliases: [{
        name: albDnsName,
        zoneId: albZoneId,
        evaluateTargetHealth: true,
      }],
    }, { parent: this });

    // ✅ Route 'adminer.domain.com' to ALB
    new aws.route53.Record(`${name}-adminer-${domain}-record-a`, {
      zoneId: zoneId,
      name: `adminer.${domain}`,
      type: "A",
      aliases: [{
        name: albDnsName,
        zoneId: albZoneId,
        evaluateTargetHealth: true,
      }],
    }, { parent: this });

    this.registerOutputs();
  }
}
