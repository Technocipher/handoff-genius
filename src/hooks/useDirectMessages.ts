import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  recipient_name?: string;
}

export interface Conversation {
  doctor_id: string;
  doctor_name: string;
  hospital_name: string | null;
  specialty: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

export const useDirectMessages = (selectedDoctorId?: string) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const fetchConversations = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const userId = userData.user.id;

      // Fetch all messages involving the current user
      const { data: allMessages, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!allMessages || allMessages.length === 0) {
        setConversations([]);
        return;
      }

      // Get unique doctor IDs from conversations
      const doctorIds = new Set<string>();
      allMessages.forEach(msg => {
        if (msg.sender_id !== userId) doctorIds.add(msg.sender_id);
        if (msg.recipient_id !== userId) doctorIds.add(msg.recipient_id);
      });

      // Fetch doctor profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, specialty, hospital_id')
        .in('id', Array.from(doctorIds));

      // Fetch hospital names
      const hospitalIds = profiles?.map(p => p.hospital_id).filter(Boolean) || [];
      const { data: hospitals } = await supabase
        .from('hospitals')
        .select('id, name')
        .in('id', hospitalIds);

      const hospitalMap = new Map(hospitals?.map(h => [h.id, h.name]) || []);
      const profileMap = new Map(profiles?.map(p => [p.id, { ...p, hospital_name: hospitalMap.get(p.hospital_id) || null }]) || []);

      // Build conversations list
      const conversationMap = new Map<string, Conversation>();

      allMessages.forEach(msg => {
        const otherDoctorId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
        const profile = profileMap.get(otherDoctorId);

        if (!conversationMap.has(otherDoctorId)) {
          conversationMap.set(otherDoctorId, {
            doctor_id: otherDoctorId,
            doctor_name: profile?.full_name || 'Unknown Doctor',
            hospital_name: profile?.hospital_name || null,
            specialty: profile?.specialty || null,
            last_message: msg.message,
            last_message_time: msg.created_at,
            unread_count: 0,
          });
        }

        // Count unread messages
        if (msg.recipient_id === userId && !msg.is_read) {
          const conv = conversationMap.get(otherDoctorId)!;
          conv.unread_count += 1;
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (doctorId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const userId = userData.user.id;

      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${doctorId}),and(sender_id.eq.${doctorId},recipient_id.eq.${userId})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', [userId, doctorId]);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      setMessages(
        (data || []).map(m => ({
          ...m,
          sender_name: profileMap.get(m.sender_id) || 'Unknown',
          recipient_name: profileMap.get(m.recipient_id) || 'Unknown',
        }))
      );

      // Mark unread messages as read
      const unreadIds = data?.filter(m => m.recipient_id === userId && !m.is_read).map(m => m.id) || [];
      if (unreadIds.length > 0) {
        await supabase
          .from('direct_messages')
          .update({ is_read: true })
          .in('id', unreadIds);
      }
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    }
  };

  const sendMessage = async (recipientId: string, messageText: string) => {
    if (!messageText.trim()) return false;

    setSending(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase.from('direct_messages').insert({
        sender_id: userData.user.id,
        recipient_id: recipientId,
        message: messageText.trim(),
      });

      if (error) throw error;

      return true;
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Send failed',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedDoctorId) {
      fetchMessages(selectedDoctorId);
    }
  }, [selectedDoctorId]);

  // Real-time subscription
  useEffect(() => {
    const setupSubscription = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const userId = userData.user.id;

      const channel = supabase
        .channel('direct-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
          },
          async (payload) => {
            const newMsg = payload.new as DirectMessage;

            // Only process if we're involved in this message
            if (newMsg.sender_id !== userId && newMsg.recipient_id !== userId) return;

            // Fetch sender name
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', newMsg.sender_id)
              .single();

            const enrichedMsg: DirectMessage = {
              ...newMsg,
              sender_name: profile?.full_name || 'Unknown',
            };

            // Update messages if viewing this conversation
            if (selectedDoctorId && (newMsg.sender_id === selectedDoctorId || newMsg.recipient_id === selectedDoctorId)) {
              setMessages(prev => [...prev, enrichedMsg]);

              // Mark as read if we're the recipient
              if (newMsg.recipient_id === userId) {
                await supabase
                  .from('direct_messages')
                  .update({ is_read: true })
                  .eq('id', newMsg.id);
              }
            }

            // Refresh conversations
            fetchConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupSubscription();
  }, [selectedDoctorId]);

  return {
    messages,
    conversations,
    loading,
    sending,
    sendMessage,
    refetchConversations: fetchConversations,
    refetchMessages: selectedDoctorId ? () => fetchMessages(selectedDoctorId) : undefined,
  };
};
