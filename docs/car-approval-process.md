# Car Approval Process

## Overview
This document outlines the car approval process in the HireApp system, detailing how cars are submitted, reviewed, and approved for use on the platform.

## Initial State
When a car is first created in the system:
- It starts with an `approvalStatus` of `PENDING`
- Several documents and images are required for approval:
  - MOT Certificate
  - Insurance Certificate
  - Vehicle Images

## Document and Image Submission
During car creation:
- Vehicle images are stored as `VehicleImage` records with `PENDING` status
- MOT Certificate and Insurance Certificate are stored as `DocumentApproval` records with `PENDING` status

## Admin Review Process
Administrators can review pending documents and images through the admin interface:

### Review Options
For each document/image, admins can:
- **Approve**: Updates the status to `APPROVED`
- **Reject**: Updates the status to `REJECTED` and can include rejection notes

### Admin Interface Display
The interface shows:
- Car details (make, model, year, registration number)
- Owner information
- Document/image previews

## Automatic Car Approval
A car is automatically approved when ALL conditions are met:
- All required documents (MOT, Insurance) are approved
- All vehicle images are approved

If any document or image is rejected:
- The car's approval status is set to `PENDING`
- Rejection notes are added to explain why
- The owner is notified of the rejection

## Status Types
Cars can have three approval statuses:
- `PENDING`: Initial state or when documents need review
- `APPROVED`: All documents and images are approved
- `REJECTED`: One or more documents/images were rejected

## Notifications
When a car's approval status changes:
- System sends email notifications to the owner
- Email includes:
  - Car details (make, model, year)
  - Approval/rejection status
  - Additional information in case of rejection

## Fleet Owner Impact
- A fleet owner cannot be approved unless they have at least one approved car
- The fleet owner's status is tied to their cars' approval status

This process ensures that all cars meet the required standards and have proper documentation before being approved for use in the system.
