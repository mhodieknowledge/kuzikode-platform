# 04 — Database Design (Cloudflare D1 / SQLite)

Normative design. Refine during implementation, and record any deviation in DECISIONS.md.
Every schema change is a new numbered file in `migrations/`. Never edit an applied migration.

## 0. Conventions
- `PRAGMA foreign_keys` is on in D1. Declare FKs. Financial tables use `ON DELETE RESTRICT` (default NO ACTION).
- PK: `id TEXT PRIMARY KEY` (prefixed sortable IDs). Human numbers in separate UNIQUE columns.
- Every table: `created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`, `updated_at` (set by repository).
- Soft delete where noted: `archived_at` / `deleted_at TEXT NULL`. Financial rows are never soft- or hard-deleted.
- Money: `*_minor INTEGER NOT NULL` + `currency TEXT NOT NULL REFERENCES currencies(code)`.
- Enums: `TEXT` + `CHECK (status IN (...))`. Mirror the same lists in `src/shared/types`.
- JSON columns (`TEXT`, validated with Zod on write) only for snapshots, metadata and flexible CMS blocks.
- Index every FK and every column used in filters/sorts. Composite index for common list queries
  (e.g. `invoices(status, due_date)`, `invoices(client_id, created_at)`).

## 1. Identity & access
| Table | Key columns / constraints |
|---|---|
| `users` | id, email (UNIQUE, lower-cased), name, phone, `user_type` CHECK('staff','client'), password_hash, password_updated_at, email_verified_at, status CHECK('invited','active','disabled'), must_change_password INT, last_login_at, failed_login_count, locked_until |
| `sessions` | id, user_id FK, token_hash UNIQUE (SHA-256 of cookie token), `audience` CHECK('admin','portal'), csrf_secret, ip, user_agent, created_at, last_seen_at, expires_at, revoked_at. Index (user_id), (expires_at) |
| `auth_tokens` | id, user_id FK NULL, email, `purpose` CHECK('invite_staff','invite_client','password_reset','email_verify'), token_hash UNIQUE, expires_at, used_at, metadata JSON (e.g. client_id + access role for invites), created_by |
| `roles` | id, key UNIQUE (`super_admin`,`admin`,`finance_manager`,`project_manager`,`content_manager`,`support_staff`), name, description, is_system INT |
| `permissions` | key PK (e.g. `invoices.issue`), module, description |
| `role_permissions` | role_id FK, permission_key FK, PK(role_id, permission_key) |
| `user_roles` | user_id FK, role_id FK, PK(user_id, role_id), granted_by, granted_at |
| `rate_limits` | key PK (e.g. `login:ip:1.2.3.4`), window_start, count. Pruned by cron |
| `idempotency_keys` | key + scope PK, user_id, request_hash, response_status, response_body, created_at (expires 24h) |

## 2. Clients & CRM
| Table | Key columns |
|---|---|
| `clients` | id, client_number UNIQUE (`CL-0001`), type CHECK('individual','business'), display_name, legal_name, email, phone, website, tax_number, billing_address JSON, physical_address JSON, default_currency FK, payment_terms_days, notes, tags JSON, status CHECK('active','archived'), archived_at |
| `client_contacts` | id, client_id FK, name, email, phone, job_title, is_primary INT, is_billing INT. Partial UNIQUE index on (client_id) WHERE is_primary=1 |
| `client_user_access` | id, client_id FK, user_id FK, role CHECK('owner','member','billing'), status CHECK('pending','active','revoked'), approved_by, approved_at, UNIQUE(client_id,user_id) |
| `client_notes` | id, client_id FK, author_id FK, body, created_at |
| `client_credits` | id, client_id FK, currency, amount_minor (+credit / −applied), source_type ('overpayment','credit_note','refund','applied'), source_id, created_by. Balance = SUM per (client, currency) |
| `enquiries` | id, reference UNIQUE (`ENQ-2026-0001`), name, email, phone, organisation, category, service_id FK NULL, budget_range, message, consent_at, ip_hash, user_agent, status CHECK('new','triaged','spam','closed'), lead_id FK NULL |
| `leads` | id, title, source CHECK('website','referral','manual','social','other'), status CHECK('new','contacted','qualified','proposal_sent','won','lost'), contact_name, email, phone, organisation, assigned_to FK users, estimated_value_minor NULL, currency NULL, next_follow_up_on, lost_reason, client_id FK NULL (after conversion), converted_at |
| `lead_services` | lead_id FK, service_id FK, PK |
| `lead_activities` | id, lead_id FK, user_id FK, type CHECK('note','call','email','meeting','status_change','follow_up'), body, due_on, completed_at |

## 3. Service catalogue
| Table | Key columns |
|---|---|
| `service_categories` | id, slug UNIQUE, name, summary, description (sanitized HTML), benefits JSON, deliverables JSON, faq JSON, icon, status CHECK('active','coming_soon','inactive'), featured, sort_order, seo_title, seo_description, og_image_id FK media |
| `services` | id, category_id FK, slug UNIQUE(category_id, slug), name, summary, description, pricing_model CHECK('fixed','hourly','starting_from','custom_quote'), price_minor NULL, currency NULL, CHECK((pricing_model='custom_quote') OR (price_minor IS NOT NULL AND currency IS NOT NULL)), status, featured, sort_order |

## 4. Quotations
| Table | Key columns |
|---|---|
| `quotations` | id, number UNIQUE NULL (assigned on first send), client_id FK, contact_id FK NULL, lead_id FK NULL, title, intro_html, currency, issue_date, valid_until, payment_terms, notes, terms, discount_type CHECK('none','percent','amount'), discount_value, subtotal_minor, discount_minor, tax_minor, total_minor, status CHECK('draft','sent','viewed','accepted','rejected','expired','void'), version INT, parent_quotation_id FK NULL, public_token_hash UNIQUE, viewed_at, accepted_at, accepted_by_name, accepted_ip, rejected_at, rejection_reason, client_snapshot JSON, business_snapshot JSON, pdf_file_id FK NULL, created_by |
| `quotation_items` | id, quotation_id FK, position, service_id FK NULL, description, quantity_milli INT CHECK(>0), unit_price_minor INT CHECK(>=0), discount_type, discount_value, tax_rate_id FK NULL, tax_rate_bp INT (basis points snapshot, e.g. 1550), line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor |

## 5. Invoicing
| Table | Key columns |
|---|---|
| `invoices` | id, number UNIQUE NULL (assigned at issue), client_id FK, contact_id FK NULL, project_id FK NULL, source_quotation_id FK **UNIQUE** NULL (prevents double conversion), currency, issue_date, due_date, payment_terms, notes, terms, subtotal_minor, discount_minor, tax_minor, total_minor, amount_paid_minor, amount_credited_minor, balance_minor, status CHECK('draft','issued','partially_paid','paid','overdue','void'), issued_at, issued_by, voided_at, voided_by, void_reason, public_token_hash UNIQUE, client_snapshot JSON, business_snapshot JSON, pdf_file_id FK NULL, last_reminder_at, reminder_count. CHECK(balance_minor = total_minor - amount_paid_minor - amount_credited_minor) only enforced in the service; index (status, due_date), (client_id) |
| `invoice_items` | same shape as quotation_items with invoice_id |
| `invoice_status_history` | id, invoice_id FK, from_status, to_status, reason, actor_id, created_at |
| `credit_notes` | id, number UNIQUE, invoice_id FK, client_id FK, currency, reason, subtotal_minor, tax_minor, total_minor, status CHECK('issued','void'), applied_to ('invoice','client_credit','refund'), pdf_file_id, issued_by, issued_at |
| `credit_note_items` | id, credit_note_id FK, invoice_item_id FK NULL, description, quantity_milli, unit_price_minor, tax_rate_bp, line_total_minor |
| `invoice_reminders` | id, invoice_id FK, kind ('before_due','due','overdue_7','overdue_14',…), sent_at, outbox_id, UNIQUE(invoice_id, kind) (no duplicate reminders) |

## 6. Payments
| Table | Key columns |
|---|---|
| `payment_provider_accounts` | id, provider_key ('paynow','pesepay','mock'), label, mode CHECK('test','live'), secret_prefix (e.g. `PAYNOW_USD`; secrets never in DB), currencies JSON, enabled_methods JSON, options JSON (non-secret, e.g. testAuthEmail), enabled INT, updated_by |
| `payment_routes` | id, app_key ('kuzikode-platform', future products), currency ('*' allowed), method_code ('*' allowed), account_id FK, priority, enabled. Index (app_key, currency, method_code, priority) |
| `payment_attempts` | id, invoice_id FK, client_id FK, initiated_by_user_id FK NULL, provider_key, account_id FK payment_provider_accounts, flow CHECK('redirect','express'), method_code, payer_phone_masked, amount_minor CHECK(>0), currency, status CHECK('created','initiated','pending','partially_paid','succeeded','disputed','refunded','failed','cancelled','expired','reversed','error'), merchant_reference UNIQUE (our ref sent to provider), provider_reference UNIQUE NULL, redirect_url, poll_url, provider_status_raw, failure_reason, idempotency_key UNIQUE, expires_at, last_checked_at, check_count, completed_at |
| `payments` | id, receipt_number UNIQUE (`RCT-2026-00001`), client_id FK, provider_key, account_id FK NULL, method (free text from adapter: 'ecocash','onemoney','innbucks','omari','card','zimswitch','bank_transfer','cash','other'), amount_minor CHECK(>0), currency, received_at, attempt_id FK UNIQUE NULL (one payment per successful attempt), provider_reference, UNIQUE(provider_key, account_id, provider_reference) WHERE provider_reference NOT NULL, status CHECK('completed','reversed','refunded','partially_refunded'), recorded_by FK NULL (manual), notes, receipt_file_id |
| `saved_payment_methods` | id, client_id FK, created_by_user_id FK, account_id FK, provider_key, method ('vmc','zimswitch'), token_enc (AES-GCM, never sent to browser), brand, last4/masked, token_expiry, is_default, autocharge_consent_at NULL, autocharge_consent_by NULL, status CHECK('active','expired','removed'), removed_at |
| `payment_allocations` | id, payment_id FK, invoice_id FK, amount_minor CHECK(>0), currency, created_at. (A payment can split across invoices; overpayment remainder → client_credits.) |
| `payment_events` | id, provider_key, attempt_id FK NULL, event_type ('initiate_request','initiate_response','callback_received','status_check','status_change','reconcile','error'), provider_reference, dedupe_hash UNIQUE (hash of provider_ref + status + type), payload_redacted JSON, received_at |
| `refunds` | id, payment_id FK, amount_minor, currency, reason, method ('provider','manual'), provider_reference NULL, status CHECK('recorded','pending','completed','failed'), credit_note_id FK NULL, recorded_by |

## 7. Projects
| Table | Key columns |
|---|---|
| `projects` | id, reference UNIQUE, client_id FK, source_quotation_id FK NULL UNIQUE, name, description, status CHECK('planning','active','on_hold','completed','cancelled'), start_date, target_date, completed_at, budget_minor NULL, currency NULL, progress_pct INT CHECK(0-100), progress_mode ('auto','manual') |
| `project_members` | project_id FK, user_id FK, role ('lead','member'), PK |
| `project_milestones` | id, project_id FK, title, description, due_date, status CHECK('pending','in_progress','completed','cancelled'), client_visible INT, position, completed_at, invoice_id FK NULL |
| `project_tasks` | id, project_id FK, milestone_id FK NULL, title, description, assignee_id FK NULL, status CHECK('todo','in_progress','review','done'), priority, due_date, position |
| `project_updates` | id, project_id FK, author_id FK, body (sanitized), visibility CHECK('internal','client'), notified_at |
| `project_files` | id, project_id FK, file_id FK files, label, kind ('deliverable','attachment','internal'), client_visible INT, uploaded_by |
| `project_messages` | id, project_id FK, author_user_id FK, body, created_at, read_by_staff_at, read_by_client_at |

## 8. Expenses, support
| Table | Key columns |
|---|---|
| `expense_categories` | id, name UNIQUE, description, active |
| `expenses` | id, category_id FK, expense_date, vendor, description, amount_minor CHECK(>0), currency, payment_method, reference, project_id FK NULL, client_id FK NULL, receipt_file_id FK NULL, notes, status CHECK('recorded','void'), void_reason, recorded_by |
| `support_requests` | id, reference UNIQUE (`SUP-2026-0001`), client_id FK, opened_by FK users, subject, category, priority CHECK('low','normal','high','urgent'), status CHECK('open','awaiting_client','resolved','closed'), assigned_to FK NULL, project_id FK NULL |
| `support_messages` | id, request_id FK, author_id FK, body, is_internal_note INT, created_at |
| `support_attachments` | message_id FK, file_id FK |

## 9. Content (CMS) & files
| Table | Key columns |
|---|---|
| `files` | id, r2_key UNIQUE (random, never user-supplied), original_name, mime_type, size_bytes, sha256, visibility CHECK('private','public'), owner_type ('client','project','invoice','expense','media','system'), owner_id, uploaded_by, created_at |
| `media_assets` | id, file_id FK, alt_text NOT NULL, width, height, caption, folder |
| `website_pages` | id, key UNIQUE ('home','about','services','work','products','contact','legal-privacy','legal-terms','legal-cookies'), title, seo_title, seo_description, og_image_id, status CHECK('draft','published'), published_at |
| `website_sections` | id, page_id FK, key, type ('hero','rich_text','values','features','cta','services_grid','work_grid','products_grid','contact'), position, visible, draft_content JSON, published_content JSON, published_at |
| `portfolio_projects` | id, slug UNIQUE, name, client_name, show_client_name INT, category, summary, description, challenge, solution, technologies JSON, completion_date, external_url, cover_media_id, featured, status CHECK('draft','published'), sort_order, seo fields |
| `portfolio_media` | portfolio_id FK, media_id FK, position, PK |
| `products` | id, slug UNIQUE, name, tagline, description, status CHECK('in_development','beta','available'), interest_form_enabled, sort_order, published |
| `announcements` | id, message, link_url, level ('info','important'), starts_at, ends_at, active |
| `team_members` (optional) | id, name, role, bio, photo_media_id, published, sort_order |

## 10. Platform
| Table | Key columns |
|---|---|
| `application_settings` | key PK (e.g. `company.name`, `invoice.number_format`, `content_version`), value JSON, updated_by, updated_at |
| `currencies` | code PK ('USD','ZWG'), name, symbol, minor_digits, active, is_default |
| `tax_rates` | id, name, rate_bp INT (1550 = 15.5%), inclusive INT, active, is_default |
| `sequences` | key PK ('invoice:2026','quotation:2026','credit_note:2026','receipt:2026','project:2026','enquiry:2026','support:2026','client'), next_value INT NOT NULL |
| `outbox` | id, type, payload JSON, idempotency_key UNIQUE, status CHECK('pending','processing','done','failed'), attempts, last_error, available_at, processed_at |
| `notifications` | id, user_id FK, type, title, body, link, entity_type, entity_id, dedupe_key UNIQUE, read_at, created_at, in_app INT (0 = in-app channel off for this type; row kept for email), email_state ('none','pending','queued','skipped'). Index (user_id, read_at); partial index on pending emails (0010) |
| `notification_preferences` | user_id FK, type, in_app INT, email INT, PK(user_id,type) |
| `email_logs` | id, outbox_id UNIQUE, to_email, template, subject, provider, provider_message_id, status ('queued','sent','delivered','bounced','complained','failed'), error, sent_at, updated_at |
| `audit_logs` | id, actor_user_id NULL, actor_type ('staff','client','system','provider'), action ('invoice.issued','role.permission_granted',…), entity_type, entity_id, before JSON (redacted), after JSON (redacted), ip, user_agent, request_id, created_at. **Append-only:** no UPDATE/DELETE in code, and a trigger raises on UPDATE/DELETE |
| `backups` | id, kind, r2_key, size_bytes, sha256, created_at, verified_at |

## 10b. Commercial, careers & extended-site tables (docs/12, docs/13)
| Table | Key columns |
|---|---|
| `service_packages` | id, service_id FK, slug UNIQUE(service_id,slug), name, tagline, billing_type CHECK('one_off','recurring'), interval CHECK('month','year') NULL, price_type CHECK('fixed','starting_from','custom_quote'), price_minor NULL, currency NULL, alt_price_zwg_minor NULL, annual_price_minor NULL, delivery_time, revision_rounds, support_period, most_popular INT, status CHECK('active','coming_soon','inactive'), price_review_required INT, cost_note (internal), sort_order |
| `package_features` | id, package_id FK, position, label, value_type CHECK('included','not_included','text'), value_text, tooltip, comparison_key (aligns rows across packages) |
| `package_addons` | id, package_id FK NULL (NULL = global), name, description, price_minor, currency, unit ('each','page','mailbox','month'), billing_type, active, sort_order |
| `subscriptions` | id, client_id FK, package_id FK NULL, autocharge_method_id FK saved_payment_methods NULL, description, quantity_milli, unit_price_minor, currency, interval CHECK('month','year'), start_date, next_billing_date, auto_issue INT, status CHECK('active','paused','cancelled','ended','at_risk'), cancelled_at, cancel_reason, source_quotation_id FK NULL |
| `subscription_periods` | id, subscription_id FK, period_start, period_end, invoice_id FK, UNIQUE(subscription_id, period_start) (no double billing) |
| `client_assets` | id, client_id FK, type CHECK('domain','hosting','email_tenant','ssl','app_store_account','other'), name, provider, subscription_id FK NULL, renewal_date, auto_renew INT, cost_note, credentials_note (never secrets), status, UNIQUE(type,name) |
| `asset_reminders` | asset_id FK, kind ('30d','14d','7d'), renewal_date, sent_at, PK(asset_id, kind, renewal_date) |
| `job_postings` | id, slug UNIQUE, title, department, location, employment_type CHECK('full_time','part_time','contract','internship','attachment'), workplace CHECK('onsite','hybrid','remote'), salary_min_minor, salary_max_minor, salary_currency, salary_period, show_salary INT, summary, description, responsibilities JSON, requirements JSON, nice_to_haves JSON, offer JSON, custom_questions JSON, opens_at, closes_at, status CHECK('draft','open','closed','archived'), created_by |
| `job_applications` | id, reference UNIQUE (`APP-2026-0001`), posting_id FK NULL (NULL = general), full_name, email, phone, location, linkedin_url, portfolio_url, cv_file_id FK, cover_letter, cover_letter_file_id, answers JSON, notice_period, salary_expectation, consent_at, status CHECK('new','screening','interview','offer','hired','rejected','withdrawn'), rating, tags JSON, assigned_to FK NULL, anonymised_at, ip_hash |
| `job_application_events` | id, application_id FK, actor_id, type ('note','status_change','email_sent','rating'), body, created_at |
| `posts` | id, slug UNIQUE, title, excerpt, body (sanitized HTML), cover_media_id, category_id FK, author_user_id FK, author_display_name, reading_minutes, status CHECK('draft','scheduled','published'), publish_at, published_at, seo fields |
| `post_categories` / `post_tags` / `post_tag_links` | standard taxonomy tables |
| `industries` | id, slug UNIQUE, name, summary, challenges JSON, body, cover_media_id, status, sort_order, seo fields |
| `industry_services` | industry_id FK, service_id FK, PK |
| `faqs` | id, category CHECK('general','pricing','projects','support','careers'), question, answer (sanitized), service_id FK NULL, sort_order, published |
| `testimonials` | id, client_id FK **NOT NULL**, project_id FK NULL, author_name, author_role, quote, consent_obtained INT CHECK(consent_obtained=1), consent_date NOT NULL, published |
| `technologies` | id, name, logo_svg_path, category, sort_order, published |
| `newsletter_subscribers` | id, email UNIQUE, status CHECK('pending','confirmed','unsubscribed'), confirm_token_hash, confirmed_at, unsubscribed_at, source, ip_hash |
| `time_entries` | id, project_id FK, task_id FK NULL, user_id FK, entry_date, minutes CHECK(>0), description, billable INT, rate_minor, currency, invoice_id FK NULL, invoice_item_id FK NULL, timer_started_at NULL |
| `user_mfa` | user_id PK FK, totp_secret_enc, enabled_at, last_used_step (replay protection) |
| `user_backup_codes` | id, user_id FK, code_hash, used_at |

Column additions: `enquiries` + `brief JSON, package_id FK NULL, kind CHECK('contact','wizard','consultation','product_interest')`;
`invoices` + `subscription_id FK NULL`; `quotation_items`/`invoice_items` + `package_id FK NULL, period_start, period_end`.

## 11. Atomic operations (each = one `db.batch`)
- **Issue invoice:** bump sequence → set number/status/snapshots/token hash → status history → audit → outbox(generate PDF, email client, notify).
- **Apply verified payment:** insert payment (unique attempt_id + provider ref guards duplicates) →
  allocations → update invoice paid/balance/status → client credit for any excess → attempt `succeeded` →
  payment_event → audit → outbox(receipt PDF, emails, notifications).
  Guard with conditional updates (`UPDATE … WHERE id=? AND status IN (…) AND balance_minor=?`)
  and verify `meta.changes`. If the guard fails, re-read and recompute (optimistic concurrency).
- **Convert quotation:** insert invoice with `source_quotation_id` (UNIQUE) + items + audit. On UNIQUE violation, return the existing invoice.
- **Void invoice:** guard `amount_paid_minor = 0` → status void → history → audit.
- **Bill subscription period:** insert `subscription_periods` (UNIQUE guard) + invoice + items (+ issue if auto) + advance `next_billing_date` (conditional on old value) + audit + outbox.
- **Bill time entries:** add invoice items + `UPDATE time_entries SET invoice_id=? WHERE id IN (…) AND invoice_id IS NULL` (verify changes == count, else abort).

## 12. Seeds
- `seeds/base.sql`: roles, permissions, role_permissions, currencies (USD default, ZWG), tax rate
  (inactive), sequences, the 6 service divisions + sub-services (status `active`; owner adjusts),
  default CMS pages/sections with real Kuzikode copy, Business Suite product (in_development),
  expense categories, payment accounts + routes (Paynow USD account in `test` mode routed for `kuzikode-platform`, PesePay account present but unrouted, mock account only when `APP_ENV != production`).
  Idempotent (`INSERT OR IGNORE`).
- `seeds/dev.sql`: fictional data, obviously so ("Example Trading (Pvt) Ltd", `@example.com` emails),
  a few quotations/invoices/payments/projects. `scripts/seed.ts` refuses `--env production`.
