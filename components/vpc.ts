import { ComponentResource, ComponentResourceOptions } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface VpcArgs {
    cidrBlock: string;
    publicSubnetCidrs: string[];
    privateSubnetCidrs: string[];
}


// Define a VPC component
export class VPC extends ComponentResource {
    public readonly internetGateway: aws.ec2.InternetGateway;
    public readonly vpc: aws.ec2.Vpc;
    public readonly publicSubnets: aws.ec2.Subnet[];
    public readonly privateSubnets: aws.ec2.Subnet[];
    public readonly securityGroup: aws.ec2.SecurityGroup;

    constructor(name: string, args: VpcArgs, opts?: ComponentResourceOptions) {
        super("custom:resource:VpcComponent", name, {}, opts);

        // Create a VPC
        this.vpc = new aws.ec2.Vpc(name, {
            cidrBlock: args.cidrBlock,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            tags: { Name: name },
        }, { parent: this });

        // Create an internet gateway for the public subnet
        this.internetGateway = new aws.ec2.InternetGateway("cloudfocx-igw", {
            vpcId: this.vpc.id,
        }, { parent: this });

        //Dynamically fetch available availability zones for the region
        const azs = aws.getAvailabilityZones({ state: "available" }).then(result => result.names);

        // Create public and private subnets
        this.publicSubnets = [];
        this.privateSubnets = [];



        for (let i = 0; i < args.publicSubnetCidrs.length; i++) {
            this.publicSubnets.push(new aws.ec2.Subnet(`${name}-public-${i}`, {
                vpcId: this.vpc.id,
                cidrBlock: args.publicSubnetCidrs[i],
                availabilityZone: ['ap-south-1a', 'ap-south-1b', 'ap-south-1c'][i],
                mapPublicIpOnLaunch: true,
                tags: { Name: `${name}-public-${i}` },
            }, { parent: this.vpc }));
        }

        for (let i = 0; i < args.privateSubnetCidrs.length; i++) {
            this.privateSubnets.push(new aws.ec2.Subnet(`${name}-private-${i}`, {
                vpcId: this.vpc.id,
                cidrBlock: args.privateSubnetCidrs[i],
                availabilityZone: ['ap-south-1a', 'ap-south-1b', 'ap-south-1c'][i],
                tags: { Name: `${name}-private-${i}` },
            }, { parent: this.vpc }));
        }


        // Create a route table for public subnet and attach to the subnet
        const publicRouteTable = new aws.ec2.RouteTable(`${name}-public-route-table`, {
            vpcId: this.vpc.id,
            routes: [{
                cidrBlock: "0.0.0.0/0",
                gatewayId: this.internetGateway.id,
            }],
        }, { parent: this });

        this.publicSubnets.forEach((subnet, i) => {
            new aws.ec2.RouteTableAssociation(`${name}-public-route-table-association-${i}`, {
                subnetId: subnet.id,
                routeTableId: publicRouteTable.id,
            }, { parent: this });
        })

        // Create a security group
        this.securityGroup = new aws.ec2.SecurityGroup(`${name}-sg`, {
            vpcId: this.vpc.id,
            description: "Security group for CloudFocx VPC",
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: 22,
                    toPort: 22,
                    cidrBlocks: ["0.0.0.0/0"],
                },
                {
                    protocol: "tcp",
                    fromPort: 80,
                    toPort: 80,
                    cidrBlocks: ["0.0.0.0/0"],
                },
                {
                    protocol: "tcp",
                    fromPort: 443,
                    toPort: 443,
                    cidrBlocks: ["0.0.0.0/0"], // Allow from anywhere
                }
            ],
            egress: [
                {
                    protocol: "-1",
                    fromPort: 0,
                    toPort: 0,
                    cidrBlocks: ["0.0.0.0/0"],
                },
            ],
            tags: { Name: `${name}-sg` },
        }, { parent: this.vpc });

        this.registerOutputs({
            vpc: this.vpc,
            publicSubnets: this.publicSubnets,
            privateSubnets: this.privateSubnets,
            securityGroup: this.securityGroup
        });
    }
}
