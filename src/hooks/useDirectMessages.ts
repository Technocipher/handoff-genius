import { useState, useEffect, useCallback, useRef } from 'react';
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
  pending?: boolean; // For optimistic updates
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

// Cache for profile data to avoid repeated fetches
const profileCache = new Map<string, { full_name: string; specialty: string | null; hospital_name: string | null }>();

export const useDirectMessages = (selectedDoctorId?: string) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const userIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Get current user ID once
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      userIdRef.current = data.user?.id || null;
    };
    getUser();
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const userId = userData.user.id;
      userIdRef.current = userId;

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

      const doctorIds = new Set<string>();
      allMessages.forEach(msg => {
        if (msg.sender_id !== userId) doctorIds.add(msg.sender_id);
        if (msg.recipient_id !== userId) doctorIds.add(msg.recipient_id);
      });

      // Fetch profiles not in cache
      const uncachedIds = Array.from(doctorIds).filter(id => !profileCache.has(id));
      
      if (uncachedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, specialty, hospital_id')
          .in('id', uncachedIds);

        const hospitalIds = profiles?.map(p => p.hospital_id).filter(Boolean) || [];
        const { data: hospitals } = await supabase
          .from('hospitals')
          .select('id, name')
          .in('id', hospitalIds);

        const hospitalMap = new Map(hospitals?.map(h => [h.id, h.name]) || []);
        
        profiles?.forEach(p => {
          profileCache.set(p.id, {
            full_name: p.full_name,
            specialty: p.specialty,
            hospital_name: hospitalMap.get(p.hospital_id) || null
          });
        });
      }

      const conversationMap = new Map<string, Conversation>();

      allMessages.forEach(msg => {
        const otherDoctorId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
        const profile = profileCache.get(otherDoctorId);

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

        if (msg.recipient_id === userId && !msg.is_read) {
          const conv = conversationMap.get(otherDoctorId)!;
          conv.unread_count += 1;
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (doctorId: string) => {
    setMessagesLoading(true);
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

      // Use cached profile names
      const senderName = profileCache.get(userId)?.full_name || 'You';
      const recipientName = profileCache.get(doctorId)?.full_name || 'Doctor';

      setMessages(
        (data || []).map(m => ({
          ...m,
          sender_name: m.sender_id === userId ? senderName : recipientName,
          recipient_name: m.recipient_id === userId ? senderName : recipientName,
        }))
      );

      // Mark unread messages as read in background
      const unreadIds = data?.filter(m => m.recipient_id === userId && !m.is_read).map(m => m.id) || [];
      if (unreadIds.length > 0) {
        supabase
          .from('direct_messages')
          .update({ is_read: true })
          .in('id', unreadIds)
          .then(() => {
            // Update conversation unread count locally
            setConversations(prev => prev.map(c => 
              c.doctor_id === doctorId ? { ...c, unread_count: 0 } : c
            ));
          });
      }
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    } finally {
      setMessagesLoading(false);
    }
  }, [toast]);

  const sendMessage = useCallback(async (recipientId: string, messageText: string) => {
    if (!messageText.trim()) return false;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' });
      return false;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: DirectMessage = {
      id: tempId,
      sender_id: userData.user.id,
      recipient_id: recipientId,
      message: messageText.trim(),
      is_read: false,
      created_at: new Date().toISOString(),
      sender_name: 'You',
      pending: true,
    };

    // Optimistic update - add message immediately
    setMessages(prev => [...prev, optimisticMessage]);
    setSending(true);

    try {
      const { data, error } = await supabase.from('direct_messages').insert({
        sender_id: userData.user.id,
        recipient_id: recipientId,
        message: messageText.trim(),
      }).select().single();

      if (error) throw error;

      // Replace optimistic message with real one
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...data, sender_name: 'You', pending: false } : m
      ));

      // Update conversation list
      setConversations(prev => {
        const existing = prev.find(c => c.doctor_id === recipientId);
        if (existing) {
          return prev.map(c => 
            c.doctor_id === recipientId 
              ? { ...c, last_message: messageText.trim(), last_message_time: new Date().toISOString() }
              : c
          );
        }
        return prev;
      });

      return true;
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Remove failed optimistic message
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast({
        title: 'Send failed',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSending(false);
    }
  }, [toast]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch messages when doctor changes
  useEffect(() => {
    if (selectedDoctorId) {
      fetchMessages(selectedDoctorId);
    } else {
      setMessages([]);
    }
  }, [selectedDoctorId, fetchMessages]);

  // Real-time subscription
  useEffect(() => {
    const setupSubscription = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const userId = userData.user.id;

      // Clean up existing channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      channelRef.current = supabase
        .channel('direct-messages-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
          },
          async (payload) => {
            const newMsg = payload.new as DirectMessage;

            // Only process if we're involved and didn't send it ourselves
            if (newMsg.sender_id !== userId && newMsg.recipient_id !== userId) return;
            
            // Skip if we sent this (already handled optimistically)
            if (newMsg.sender_id === userId) return;

            // Get sender name from cache or fetch
            let senderName = profileCache.get(newMsg.sender_id)?.full_name;
            if (!senderName) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, specialty, hospital_id')
                .eq('id', newMsg.sender_id)
                .single();
              
              if (profile) {
                senderName = profile.full_name;
                profileCache.set(newMsg.sender_id, {
                  full_name: profile.full_name,
                  specialty: profile.specialty,
                  hospital_name: null
                });
              }
            }

            const enrichedMsg: DirectMessage = {
              ...newMsg,
              sender_name: senderName || 'Unknown',
            };

            // Update messages if viewing this conversation
            if (selectedDoctorId === newMsg.sender_id) {
              setMessages(prev => {
                // Avoid duplicates
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, enrichedMsg];
              });

              // Mark as read immediately
              supabase
                .from('direct_messages')
                .update({ is_read: true })
                .eq('id', newMsg.id);
            }

            // Update conversations
            setConversations(prev => {
              const doctorId = newMsg.sender_id === userId ? newMsg.recipient_id : newMsg.sender_id;
              const existing = prev.find(c => c.doctor_id === doctorId);
              
              if (existing) {
                return prev.map(c => 
                  c.doctor_id === doctorId 
                    ? { 
                        ...c, 
                        last_message: newMsg.message, 
                        last_message_time: newMsg.created_at,
                        unread_count: selectedDoctorId === doctorId ? 0 : c.unread_count + 1
                      }
                    : c
                ).sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());
              }
              
              // New conversation - refresh list
              fetchConversations();
              return prev;
            });
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [selectedDoctorId, fetchConversations]);

  return {
    messages,
    conversations,
    loading: conversationsLoading,
    messagesLoading,
    sending,
    sendMessage,
    refetchConversations: fetchConversations,
    refetchMessages: selectedDoctorId ? () => fetchMessages(selectedDoctorId) : undefined,
  };
};
