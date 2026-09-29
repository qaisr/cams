---
description: Review AWS CDK infrastructure — IAM, security groups, cost, compliance, best practices
agent: devops-engineer
subtask: true
---

# Infrastructure Review

## Input

$ARGUMENTS (optional scope)
Examples:

- `/infra-review` — full CDK review
- `/infra-review @infra/lib/api-stack.ts`
- `/infra-review security` — security-focused review

## Process

### Step 1: Read Infrastructure

```bash
!`find infra/lib -name "*.ts" | head -20`
!`find infra -name "cdk.json" | head -3`
!`cat infra/cdk.json 2>/dev/null`
```

Read all CDK stack files.

### Step 2: Query Standards

Query CEB MCP: "PPCC AWS infrastructure security standards"
Load: `@.claude/standards/security-standards.md#aws-security`

### Step 3: Review Against Checklist

**Networking**

```
- [ ] Fargate tasks in VPC private subnets (no public IP assigned)
- [ ] No public RDS access (publiclyAccessible: false)
- [ ] SecurityGroups: minimal inbound rules
- [ ] No 0.0.0.0/0 inbound rules
- [ ] VPC interface endpoints (PrivateLink) for Secrets Manager, SSM, EventBridge, ECR, logs (no NAT)
- [ ] Internal ALB: scheme=internal, not internet-facing
- [ ] DirectConnect — no public AWS service URLs hardcoded
- [ ] All traffic stays in ap-southeast-2
```

**IAM**

```
- [ ] Fargate task execution role: least privilege
- [ ] Fargate task role: least privilege (separate from execution role)
- [ ] No wildcard (*) actions in production policies
- [ ] No wildcard (*) resources in production policies
- [ ] No inline policies — use managed policies
- [ ] OIDC for GitHub Actions (no long-lived access keys)
- [ ] No IAM users with programmatic access (use roles)
```

**Data Protection**

```
- [ ] RDS storage encryption: true
- [ ] RDS KMS key: customer-managed (not AWS managed)
- [ ] S3 buckets: server-side encryption enabled
- [ ] SNS topics: KMS encryption enabled
- [ ] SQS queues: KMS encryption enabled
- [ ] Secrets Manager: not SSM Parameter Store for sensitive data
- [ ] RDS backup retention: ≥14 days (production)
- [ ] RDS Multi-AZ: true (production)
```

**Fargate Service + Internal ALB**

```
- [ ] Fargate service: CPU/memory appropriate for workload
- [ ] Health check: /health responds 200 (ALB target group health check configured)
- [ ] Autoscaling: target-tracking policy on CPU 60% / memory 70%
- [ ] circuitBreaker: { rollback: true } enabled on ECS service deployment config
- [ ] X-Ray active tracing: enabled (ecs.ContainerImage with X-Ray daemon sidecar or SDK)
- [ ] Fargate task role: least-privilege (no AdministratorAccess)
- [ ] Secrets: injected via Secrets Manager valueFrom (not plain-text env vars)
- [ ] Internal ALB: scheme=internal, accessible via DirectConnect only
- [ ] VPC endpoints for ECR, Secrets Manager, SSM, logs (no NAT gateway required)
- [ ] EventBridge Scheduler IAM role: ecs:RunTask permission scoped to task definition ARN
```

**Cost Controls**

```
- [ ] Log retention set (not infinite) — log groups /app/${stage}/api and /app/${stage}/batch
- [ ] S3 lifecycle policies set
- [ ] Fargate autoscaling min/max task counts configured
- [ ] RDS instance size appropriate for workload
- [ ] Tags on all resources (Project, Environment, CostCentre)
```

**Compliance**

```
- [ ] CloudTrail enabled
- [ ] Config rules for drift detection
- [ ] GuardDuty enabled
- [ ] All resources tagged with CostCentre
- [ ] Termination protection on prod stacks
- [ ] Removal policy RETAIN for stateful prod resources
```

### Step 4: CDK Diff (if reviewing changes)

```bash
!`cd infra && cdk diff 2>&1 | head -60`
```

Flag:

- Resources being DESTROYED (🔴 HIGH RISK)
- IAM changes (⚠️ REVIEW)
- Security group changes (⚠️ REVIEW)

### Step 5: Output Report

```
## Infrastructure Review Report

**Date**: {date}
**Scope**: {full / security / specific stacks}

### Summary
| Category | Pass | Warn | Fail |
|---|---|---|---|
| Networking | {N} | {N} | {N} |
| IAM | {N} | {N} | {N} |
| Data Protection | {N} | {N} | {N} |
| Fargate Service + Internal ALB | {N} | {N} | {N} |
| Cost Controls | {N} | {N} | {N} |
| Compliance | {N} | {N} | {N} |

### ❌ Critical Findings (Fix Before Deployment)
| Finding | Stack | Resource | Fix |
|---|---|---|---|

### ⚠️ Warnings (Review Required)
| Finding | Stack | Resource | Recommendation |
|---|---|---|---|

### ✅ Passing Checks
{count passing}

### CDK Changes (if diff run)
**Destructive changes**: {Y/N — list if Y}
**IAM changes**: {Y/N — describe if Y}
**Overall risk**: Low / Medium / High
```

## Cross-References

- Security: `@.claude/standards/security-standards.md`
- Deployment: `@.claude/workflows/deployment.md`
- CDK patterns: `@.claude/patterns/rds-proxy-pattern.md`
- DevOps agent: `@.claude/agents/devops-engineer.md`
