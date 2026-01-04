import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDirectMessages, Conversation } from '@/hooks/useDirectMessages';
import { useDoctors } from '@/hooks/useDoctors';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, MessageSquare, Plus, Search, User } from 'lucide-react';
import { format } from 'date-fns';

const Messages = () => {
  const { currentUser } = useAuth();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>();
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [selectedNewDoctor, setSelectedNewDoctor] = useState<string>('');

  const { messages, conversations, loading, sending, sendMessage } = useDirectMessages(selectedDoctorId);
  const { doctors, loading: doctorsLoading } = useDoctors();

  const filteredConversations = conversations.filter(
    conv => conv.doctor_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const otherDoctors = doctors.filter(d => d.id !== currentUser?.id);

  const handleSend = async () => {
    if (!selectedDoctorId || !newMessage.trim()) return;

    const success = await sendMessage(selectedDoctorId, newMessage);
    if (success) {
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartNewConversation = () => {
    if (selectedNewDoctor) {
      setSelectedDoctorId(selectedNewDoctor);
      setNewConversationOpen(false);
      setSelectedNewDoctor('');
    }
  };

  const selectedConversation = conversations.find(c => c.doctor_id === selectedDoctorId);
  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="h-[calc(100vh-4rem)] flex">
        {/* Sidebar - Conversations List */}
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Messages
              </h2>
              <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Start New Conversation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Select value={selectedNewDoctor} onValueChange={setSelectedNewDoctor}>
                      <SelectTrigger>
                        <SelectValue placeholder={doctorsLoading ? "Loading doctors..." : "Select a doctor"} />
                      </SelectTrigger>
                      <SelectContent>
                        {otherDoctors.map(doctor => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            <div className="flex flex-col">
                              <span>{doctor.full_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {doctor.specialty || 'General'} • {doctor.hospital_name || 'No hospital'}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleStartNewConversation} disabled={!selectedNewDoctor} className="w-full">
                      Start Conversation
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs">Start a new conversation with a doctor</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredConversations.map(conv => (
                  <button
                    key={conv.doctor_id}
                    onClick={() => setSelectedDoctorId(conv.doctor_id)}
                    className={`w-full p-4 text-left hover:bg-accent/50 transition-colors ${
                      selectedDoctorId === conv.doctor_id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {conv.doctor_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{conv.doctor_name}</p>
                          {conv.unread_count > 0 && (
                            <Badge variant="default" className="ml-2">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.specialty || 'Doctor'} • {conv.hospital_name || 'No hospital'}
                        </p>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {conv.last_message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(conv.last_message_time), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedDoctorId ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {(selectedConversation?.doctor_name || selectedDoctor?.full_name || 'U')
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {selectedConversation?.doctor_name || selectedDoctor?.full_name || 'Doctor'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation?.specialty || selectedDoctor?.specialty || 'Doctor'} •{' '}
                    {selectedConversation?.hospital_name || selectedDoctor?.hospital_name || 'No hospital'}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-sm">Send a message to start the conversation</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map(msg => {
                      const isOwn = msg.sender_id === currentUser?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              isOwn
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            <p
                              className={`text-xs mt-1 ${
                                isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              }`}
                            >
                              {format(new Date(msg.created_at), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="min-h-[44px] max-h-32 resize-none"
                    rows={1}
                  />
                  <Button onClick={handleSend} disabled={sending || !newMessage.trim()}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a doctor from the sidebar or start a new conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
