import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysBeforeDeletion = new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000); // 23 days since archive = 7 days before deletion

    console.log('Starting data retention job...');
    console.log('Current time:', now.toISOString());

    // Step 1: Auto-archive uploads older than 24 hours that aren't already archived
    const { data: uploadsToArchive, error: archiveQueryError } = await supabase
      .from('data_center_uploads')
      .select('id, user_id, file_name, created_at')
      .is('archived_at', null)
      .lt('created_at', twentyFourHoursAgo.toISOString());

    if (archiveQueryError) {
      console.error('Error fetching uploads to archive:', archiveQueryError);
    } else if (uploadsToArchive && uploadsToArchive.length > 0) {
      console.log(`Found ${uploadsToArchive.length} uploads to auto-archive`);

      for (const upload of uploadsToArchive) {
        // Archive the upload
        const { error: archiveError } = await supabase
          .from('data_center_uploads')
          .update({ archived_at: now.toISOString(), status: 'archived' })
          .eq('id', upload.id);

        if (archiveError) {
          console.error(`Error archiving upload ${upload.id}:`, archiveError);
          continue;
        }

        // Create notification for user
        await supabase.from('data_retention_notifications').insert({
          user_id: upload.user_id,
          upload_id: upload.id,
          notification_type: 'archived',
          message: `Your upload "${upload.file_name}" has been automatically archived. It will be permanently deleted in 30 days. Download your data and audit trails for record keeping before deletion.`,
        });

        console.log(`Archived upload: ${upload.id} (${upload.file_name})`);
      }
    }

    // Step 2: Send deletion warnings for uploads archived ~23 days ago (7 days before deletion)
    const { data: uploadsNeedingWarning, error: warningQueryError } = await supabase
      .from('data_center_uploads')
      .select('id, user_id, file_name, archived_at')
      .not('archived_at', 'is', null)
      .is('deletion_warning_sent_at', null)
      .lt('archived_at', sevenDaysBeforeDeletion.toISOString());

    if (warningQueryError) {
      console.error('Error fetching uploads needing warning:', warningQueryError);
    } else if (uploadsNeedingWarning && uploadsNeedingWarning.length > 0) {
      console.log(`Found ${uploadsNeedingWarning.length} uploads needing deletion warning`);

      for (const upload of uploadsNeedingWarning) {
        // Mark warning as sent
        const { error: updateError } = await supabase
          .from('data_center_uploads')
          .update({ deletion_warning_sent_at: now.toISOString() })
          .eq('id', upload.id);

        if (updateError) {
          console.error(`Error updating warning status for ${upload.id}:`, updateError);
          continue;
        }

        // Create warning notification
        await supabase.from('data_retention_notifications').insert({
          user_id: upload.user_id,
          upload_id: upload.id,
          notification_type: 'deletion_warning',
          message: `⚠️ FINAL WARNING: Your upload "${upload.file_name}" will be permanently deleted in 7 days. Download your data and audit trails NOW for record keeping.`,
        });

        console.log(`Sent deletion warning for upload: ${upload.id}`);
      }
    }

    // Step 3: Delete archived uploads older than 30 days
    const { data: uploadsToDelete, error: deleteQueryError } = await supabase
      .from('data_center_uploads')
      .select('id, user_id, file_name, archived_at')
      .not('archived_at', 'is', null)
      .lt('archived_at', thirtyDaysAgo.toISOString());

    if (deleteQueryError) {
      console.error('Error fetching uploads to delete:', deleteQueryError);
    } else if (uploadsToDelete && uploadsToDelete.length > 0) {
      console.log(`Found ${uploadsToDelete.length} uploads to permanently delete`);

      for (const upload of uploadsToDelete) {
        // Create deletion notification BEFORE deleting (so we have the upload_id reference)
        await supabase.from('data_retention_notifications').insert({
          user_id: upload.user_id,
          upload_id: null, // Will be null since upload is being deleted
          notification_type: 'deleted',
          message: `Your upload "${upload.file_name}" has been permanently deleted as per the 30-day retention policy.`,
        });

        // Delete staging rows first (due to foreign key)
        const { error: stagingDeleteError } = await supabase
          .from('data_center_staging_rows')
          .delete()
          .eq('upload_id', upload.id);

        if (stagingDeleteError) {
          console.error(`Error deleting staging rows for ${upload.id}:`, stagingDeleteError);
        }

        // Delete the upload
        const { error: uploadDeleteError } = await supabase
          .from('data_center_uploads')
          .delete()
          .eq('id', upload.id);

        if (uploadDeleteError) {
          console.error(`Error deleting upload ${upload.id}:`, uploadDeleteError);
          continue;
        }

        console.log(`Deleted upload: ${upload.id} (${upload.file_name})`);
      }
    }

    // Step 4: Clean up old notifications (older than 90 days)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const { error: notificationCleanupError } = await supabase
      .from('data_retention_notifications')
      .delete()
      .lt('created_at', ninetyDaysAgo.toISOString());

    if (notificationCleanupError) {
      console.error('Error cleaning up old notifications:', notificationCleanupError);
    }

    const summary = {
      archived: uploadsToArchive?.length || 0,
      warned: uploadsNeedingWarning?.length || 0,
      deleted: uploadsToDelete?.length || 0,
      timestamp: now.toISOString(),
    };

    console.log('Data retention job completed:', summary);

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Data retention cron error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
