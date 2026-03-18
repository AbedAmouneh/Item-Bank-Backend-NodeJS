import { db } from '../platform/database/connection';
import { createChildLogger } from './logger';
import { runtime } from './runtime';

const logger = createChildLogger('job-tracker');

interface JobTrackingRecord {
  id: number;
  job_name: string;
  schedule_pattern: string;
  last_run: Date | null;
  next_run: Date | null;
  status: 'scheduled' | 'running' | 'completed' | 'failed';
  is_active: boolean;
}

export class JobTracker {
  async getJobStatus(jobName: string): Promise<JobTrackingRecord | null> {
    const query = `
      SELECT * FROM jobs
      WHERE job_name = $1 AND is_active = true
    `;

    const result = await db.query(query, [jobName]);
    return (result.rows[0] as JobTrackingRecord) || null;
  }

  async shouldRunJob(
    jobName: string,
    schedulePattern: string
  ): Promise<boolean> {
    const job = await this.getJobStatus(jobName);

    if (!job) {
      // Job doesn't exist, should create and run
      await this.createJob(jobName, schedulePattern);
      return true;
    }

    // Check if schedule pattern changed
    if (job.schedule_pattern !== schedulePattern) {
      logger.info(
        `Schedule pattern changed for ${jobName}: ${job.schedule_pattern} -> ${schedulePattern}`
      );
      await this.updateJobSchedule(jobName, schedulePattern);
      return true;
    }

    // Check if it's time to run based on next_run
    if (
      job.next_run &&
      runtime.now() >= job.next_run &&
      job.status !== 'running'
    ) {
      return true;
    }

    return false;
  }

  async createJob(jobName: string, schedulePattern: string): Promise<void> {
    const nextRun = this.calculateNextRun(schedulePattern);

    const query = `
      INSERT INTO jobs (job_name, schedule_pattern, next_run, status)
      VALUES ($1, $2, $3, 'scheduled')
      ON CONFLICT (job_name)
      DO UPDATE SET
        schedule_pattern = EXCLUDED.schedule_pattern,
        next_run = EXCLUDED.next_run,
        is_active = true,
        updated_on = NOW()
    `;

    await db.query(query, [jobName, schedulePattern, nextRun]);
    logger.info(
      `Created/updated job tracking for ${jobName} with pattern ${schedulePattern}`
    );
  }

  async updateJobSchedule(
    jobName: string,
    schedulePattern: string
  ): Promise<void> {
    const nextRun = this.calculateNextRun(schedulePattern);

    const query = `
      UPDATE jobs
      SET schedule_pattern = $1, next_run = $2, updated_on = NOW()
      WHERE job_name = $3
    `;

    await db.query(query, [schedulePattern, nextRun, jobName]);
  }

  async markJobRunning(jobName: string): Promise<void> {
    const query = `
      UPDATE jobs
      SET status = 'running', updated_on = NOW()
      WHERE job_name = $1
    `;

    await db.query(query, [jobName]);
  }

  async markJobCompleted(jobName: string): Promise<void> {
    const now = runtime.now();
    const job = await this.getJobStatus(jobName);

    if (!job) {
      logger.error(`Cannot mark job completed - job ${jobName} not found`);
      return;
    }

    const nextRun = this.calculateNextRun(job.schedule_pattern);

    const query = `
      UPDATE jobs
      SET status = 'completed', last_run = $1, next_run = $2, updated_on = NOW()
      WHERE job_name = $3
    `;

    await db.query(query, [now, nextRun, jobName]);
    logger.info(
      `Job ${jobName} completed. Next run: ${nextRun?.toISOString()} (pattern: ${job.schedule_pattern})`
    );
  }

  async markJobFailed(jobName: string, error?: any): Promise<void> {
    const now = runtime.now();

    const query = `
      UPDATE jobs
      SET status = 'failed', last_run = $1, updated_on = NOW()
      WHERE job_name = $2
    `;

    await db.query(query, [now, jobName]);
    logger.error({ jobName, error }, `Job ${jobName} failed`);
  }

  private calculateNextRun(schedulePattern: string): Date {
    const now = runtime.now();
    const next = new Date(now);

    // Parse second intervals (*/X * * * * *)
    const secondIntervalMatch = schedulePattern.match(
      /^\*\/(\d+) \* \* \* \* \*$/
    );
    if (secondIntervalMatch) {
      const interval = parseInt(secondIntervalMatch[1]!);

      // Add the interval to current time
      next.setSeconds(next.getSeconds() + interval);
      next.setMilliseconds(0);

      return next;
    }

    // Parse minute intervals (*/X * * * *)
    const minuteIntervalMatch = schedulePattern.match(
      /^\*\/(\d+) \* \* \* \*$/
    );
    if (minuteIntervalMatch) {
      const interval = parseInt(minuteIntervalMatch[1]!);
      const currentMinutes = now.getMinutes();
      const nextMinute = Math.ceil((currentMinutes + 1) / interval) * interval;

      if (nextMinute >= 60) {
        next.setHours(next.getHours() + 1);
        next.setMinutes(0, 0, 0);
      } else {
        next.setMinutes(nextMinute, 0, 0);
      }
      return next;
    }

    // Parse hour intervals (0 */X * * *)
    const hourIntervalMatch = schedulePattern.match(/^0 \*\/(\d+) \* \* \*$/);
    if (hourIntervalMatch) {
      const interval = parseInt(hourIntervalMatch[1]!);
      const currentHour = now.getHours();
      const nextHour = Math.ceil((currentHour + 1) / interval) * interval;

      if (nextHour >= 24) {
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
      } else {
        next.setHours(nextHour, 0, 0, 0);
      }
      return next;
    }

    // Parse daily at specific time (0 H * * *)
    const dailyMatch = schedulePattern.match(/^0 (\d+) \* \* \*$/);
    if (dailyMatch) {
      const hour = parseInt(dailyMatch[1]!);
      const currentHour = now.getHours();

      if (currentHour < hour) {
        next.setHours(hour, 0, 0, 0);
      } else {
        next.setDate(next.getDate() + 1);
        next.setHours(hour, 0, 0, 0);
      }
      return next;
    }

    // Default fallback: add 30 minutes
    next.setMinutes(next.getMinutes() + 30);
    return next;
  }
}

export const jobTracker = new JobTracker();
