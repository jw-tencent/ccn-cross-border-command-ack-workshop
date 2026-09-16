variable "project_name" {
  description = "A short tag prefix for reference resources."
  type        = string
  default     = "ccn-command-ack-demo"
}

variable "china_region" {
  description = "China Mainland ingress region, subject to account and product eligibility."
  type        = string
  default     = "ap-guangzhou"
}

variable "us_region" {
  description = "US origin region."
  type        = string
  default     = "na-siliconvalley"
}

variable "china_vpc_cidr" {
  description = "Non-overlapping CIDR for the China Mainland VPC."
  type        = string
  default     = "10.10.0.0/16"
}

variable "us_vpc_cidr" {
  description = "Non-overlapping CIDR for the US VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "demo_domain" {
  description = "Public Direct demo hostname. Use a domain controlled by the deployer."
  type        = string
  default     = "demo.example.com"
}

variable "routed_domain" {
  description = "Public China Mainland ingress hostname. Use a separate deployer-controlled hostname."
  type        = string
  default     = "ccn-path.example.com"
}
