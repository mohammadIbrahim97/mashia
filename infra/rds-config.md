# RDS PostgreSQL Configuration — AWS Bahrain (me-south-1)

## Instance Settings
- Engine: PostgreSQL 16
- Instance class: db.t3.medium (MVP), db.r6g.large (Growth)
- Multi-AZ: Yes (production)
- Storage: 50 GB gp3, auto-scaling up to 200 GB
- Region: me-south-1 (Bahrain)

## Network
- VPC: mashia-vpc
- Subnet group: mashia-db-subnet (private subnets only)
- Security group: Allow port 5432 from ECS security group only
- Public access: No

## Backup
- Automated backups: 7 days retention
- Backup window: 03:00-04:00 UTC (06:00-07:00 AST)
- Maintenance window: Sun 04:00-05:00 UTC

## Parameters
- max_connections: 200
- shared_buffers: 256MB
- work_mem: 16MB
- effective_cache_size: 768MB
