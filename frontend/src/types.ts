export type RuleField = "poster" | "title" | "category" | "size" | "date";

export interface WatchRule {
  field: RuleField;
  operator: string;
  value: string;
}

export interface Watch {
  id: number;
  name: string;
  is_active: boolean;
  rules: WatchRule[];
  interval_minutes: number;
  download_client: string;
  created_at: string;
  last_run_at: string | null;
  total_sent: number;
}

export interface WatchStats extends Watch {
  this_week: number;
  avg_size_mb: number;
  failed_count: number;
}

export type ActivityStatus = "sent" | "skipped_duplicate" | "failed";

export interface ActivityItem {
  id: number;
  watch_id: number | null;
  watch_name: string;
  spot_id: string;
  spot_title: string;
  spot_size_bytes: number | null;
  spot_category: string;
  status: ActivityStatus;
  error_message: string | null;
  sent_at: string;
}

export interface ActivityStatsData {
  sent: number;
  skipped_duplicate: number;
  failed: number;
  total: number;
}

export interface Settings {
  spotweb_connection_type: "api" | "mariadb";
  spotweb_api_url: string;
  spotweb_api_key: string;
  spotweb_db_host: string;
  spotweb_db_port: string;
  spotweb_db_name: string;
  spotweb_db_user: string;
  spotweb_db_pass: string;
  download_client_type: "sabnzbd" | "nzbget";
  download_client_host: string;
  download_client_port: string;
  download_client_api_key: string;
  download_client_username: string;
  download_client_password: string;
  download_client_category: string;
}

export interface TestResult {
  ok: boolean;
  message: string;
  spot_count?: number | null;
}
