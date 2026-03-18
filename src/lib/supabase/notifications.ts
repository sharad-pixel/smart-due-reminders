import { supabase } from "@/integrations/supabase/client";

export interface UserNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  source_type?: string;
  source_id?: string;
  sender_id?: string;
  sender_name?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

/**
 * Fetch notifications for a user.
 */
export async function fetchNotifications(
  userId: string,
  limit = 50
): Promise<UserNotification[]> {
  const { data, error } = await supabase
    .from("user_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as UserNotification[];
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from("user_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) throw error;
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("user_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;
}

/**
 * Delete a notification.
 */
export async function deleteNotification(notificationId: string) {
  const { error } = await supabase
    .from("user_notifications")
    .delete()
    .eq("id", notificationId);

  if (error) throw error;
}

/**
 * Create a mention notification (sends email + in-app notification via edge function).
 */
export async function createMentionNotification(
  mentionedUserId: string,
  senderName: string,
  senderId: string,
  taskId: string,
  taskSummary: string,
  noteContent?: string
) {
  try {
    const { error } = await supabase.functions.invoke('send-mention-notification', {
      body: {
        mentionedUserId,
        senderName,
        senderId,
        taskId,
        taskSummary,
        noteContent
      }
    });

    if (error) throw error;
    console.log('[createMentionNotification] Successfully sent mention notification to:', mentionedUserId);
  } catch (error) {
    console.error('Error creating mention notification:', error);
  }
}

/**
 * Clear all notifications for a user.
 */
export async function clearAllNotifications(userId: string) {
  const { error } = await supabase
    .from("user_notifications")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}
