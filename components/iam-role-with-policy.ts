import { ComponentResource, ComponentResourceOptions, Input } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Define the arguments for the ECS component
interface IamRoleWithPolicyArgs {
    assumeRolePolicy: Input<string | aws.iam.PolicyDocument>;
    policyAttachmentArn?: Input<string>
}


// Define an ECS component
export class IamRoleWithPolicy extends ComponentResource {
    public readonly role: aws.iam.Role;

    constructor(name: string, args: IamRoleWithPolicyArgs, opts?: ComponentResourceOptions) {
        super("custom:resource:IamRole", name, {}, opts);


        // Create an IAM role for ECS task execution
        this.role = new aws.iam.Role(`${name}-role`, {
            name: `${name}-role`,
            assumeRolePolicy: args.assumeRolePolicy,
        }, { parent: this });

        // Attach the AmazonECSTaskExecutionRolePolicy to the IAM Role
        if (args.policyAttachmentArn)
            new aws.iam.RolePolicyAttachment(`${name}-role-policy-attachment`, {
                role: this.role.name,
                policyArn: args.policyAttachmentArn,
            }, { parent: this });

        this.registerOutputs({
            role: this.role,
        })

    }

}