import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { ConversationList } from '../../components/chat/ConversationList';
import { PageSEO } from '../../components/common/PageSEO';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import {
  ensureConversation,
  getMessages,
  markConversationAsRead,
  sendMessage,
  subscribeConversations,
  subscribeMessages
} from '../../services/chatService';
import { subscribeBookingById } from '../../services/bookingService';
import { getLabourById } from '../../services/labourService';
import { createNotification } from '../../services/notificationService';
import { getUserProfile } from '../../services/userService';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';

const decorateConversationForUser = (conversation, currentUserId) => {
  const participantIds = Array.isArray(conversation.participantIds)
    ? conversation.participantIds
    : Object.keys(conversation.participantIds || {});
  const otherUserId = participantIds.find((id) => id !== currentUserId);
  const otherProfile = otherUserId ? conversation.participantProfiles?.[otherUserId] : null;

  return {
    ...conversation,
    otherUserId,
    displayName: otherProfile?.fullName || conversation.participantName || 'Slivz user',
    displayRole: otherProfile?.role || conversation.participantRole || '',
    phoneNumber: otherProfile?.phoneNumber || conversation.phoneNumber || '',
    whatsAppLink: otherProfile?.whatsAppLink || conversation.whatsAppLink || ''
  };
};

const ChatPage = () => {
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('target');
  const bookingId = searchParams.get('booking');
  const targetConversationId = searchParams.get('conversation');
  const { currentUser, userProfile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [accessError, setAccessError] = useState('');

  const handleChatError = (error) => {
    const message = getFirebaseErrorMessage(error);
    setAccessError(message);
    toast.error(message);
  };

  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      setActiveConversation(null);
      setAccessError('');
      return undefined;
    }

    return subscribeConversations(
      currentUser.uid,
      (items) => {
        setAccessError('');
        setConversations(items.map((item) => decorateConversationForUser(item, currentUser.uid)));
      },
      handleChatError
    );
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser || !targetUserId) {
      return undefined;
    }

    if (!bookingId) {
      return undefined;
    }

    let isActive = true;

    Promise.all([
      getUserProfile(targetUserId),
      getLabourById(targetUserId).catch(() => null)
    ])
      .then(([profile, labour]) => {
        const otherProfile = profile || labour || {};

        if (!profile && !labour) {
          return null;
        }

        return (
        ensureConversation({
          currentUserId: currentUser.uid,
          otherUserId: targetUserId,
          metadata: {
            bookingId: bookingId || '',
            currentUserProfile: {
              fullName: userProfile?.fullName,
              role: userProfile?.role,
              phoneNumber: userProfile?.phoneNumber || currentUser.phoneNumber || ''
            },
            otherUserProfile: {
              fullName: otherProfile?.fullName,
              role: otherProfile?.role || otherProfile?.category || 'Slivz user',
              phoneNumber: otherProfile?.phoneNumber || '',
              whatsAppLink: otherProfile?.phoneNumber
                ? `https://wa.me/${otherProfile.phoneNumber.replace(/\D/g, '')}`
                : ''
            }
          }
        })
        );
      })
      .then(() => {
        if (!isActive) {
          return;
        }
        setAccessError('');
      })
      .catch((error) => handleChatError(error));

    return () => {
      isActive = false;
    };
  }, [
    currentUser?.phoneNumber,
    currentUser?.uid,
    bookingId,
    targetUserId,
    userProfile?.fullName,
    userProfile?.phoneNumber,
    userProfile?.role
  ]);

  useEffect(() => {
    if (!activeConversation?.bookingId) {
      setActiveBooking(null);
      return undefined;
    }

    return subscribeBookingById(
      activeConversation.bookingId,
      setActiveBooking,
      () => setActiveBooking(null)
    );
  }, [activeConversation?.bookingId]);

  useEffect(() => {
    if (currentUser?.uid && activeConversation?.id) {
      markConversationAsRead(activeConversation.id, currentUser.uid).catch(() => {});
    }
  }, [activeConversation?.id, currentUser?.uid, messages.length]);

  useEffect(() => {
    if (!targetUserId || bookingId || targetConversationId) {
      return undefined;
    }

    const matchingConversation = conversations.find((item) =>
      item.participantIds?.includes(targetUserId)
    );

    if (matchingConversation) {
      setAccessError('');
      return undefined;
    }

    setAccessError('Chat is only available after a service booking.');
    return undefined;
  }, [bookingId, conversations, targetConversationId, targetUserId]);

  const chatLocked = activeBooking?.status === 'completed';
  const chatLockedMessage = chatLocked ? 'Chat is closed after the service is completed.' : '';

  useEffect(() => {
    setActiveConversation((prev) => {
      if (!conversations.length) {
        return null;
      }

      if (targetConversationId) {
        const conversation = conversations.find((item) => item.id === targetConversationId);

        if (conversation) {
          return conversation;
        }
      }

      if (targetUserId) {
        const targetedConversation = conversations.find((item) =>
          item.participantIds?.includes(targetUserId)
        );

        if (targetedConversation) {
          return targetedConversation;
        }
      }

      return conversations.find((item) => item.id === prev?.id) ?? conversations[0];
    });
    setAccessError('');
  }, [conversations, targetConversationId, targetUserId]);

  useEffect(() => {
    if (!activeConversation?.id) {
      setMessages([]);
      return undefined;
    }

    return subscribeMessages(
      activeConversation.id,
      (items) => {
        setAccessError('');
        setMessages(items);
      },
      handleChatError
    );
  }, [activeConversation?.id]);

  const handleSend = async (text) => {
    if (!activeConversation || !currentUser || chatLocked) {
      return;
    }

    const optimisticMessage = {
      id: `local-${Date.now()}`,
      senderId: currentUser.uid,
      text,
      type: 'text',
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const recipientId = activeConversation.otherUserId;

      await sendMessage(activeConversation.id, {
        senderId: currentUser.uid,
        recipientId,
        senderRole: userProfile?.role ?? 'client',
        text,
        type: 'text'
      });

      if (recipientId && activeConversation.bookingId) {
        try {
          await createNotification({
            userId: recipientId,
            senderId: currentUser.uid,
            bookingId: activeConversation.bookingId,
            type: 'chat',
            title: `New message from ${userProfile?.fullName || 'Slivz user'}`,
            body: text.length > 120 ? `${text.slice(0, 117)}...` : text,
            conversationId: activeConversation.id
          });
        } catch (notificationError) {
          console.warn('[Slivz chat] notification write skipped', notificationError);
        }
      }

      const nextMessages = await getMessages(activeConversation.id);
      setMessages(nextMessages);
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    }
  };

  return (
    <AppShell>
      <PageSEO title="Chat" description="Real-time one-to-one chat between clients and labour professionals." />

      <section className="section-space">
        <div className="page-shell grid gap-4 xl:grid-cols-[360px_1fr] xl:gap-6">
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversation?.id}
            onSelect={setActiveConversation}
          />
          <div className="space-y-4">
            {accessError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <p className="font-semibold">Chat is blocked by Realtime Database rules right now.</p>
                <p className="mt-2">
                  Deploy the Slivz Realtime Database rules, then refresh the page. Chat will work once RTDB
                  allows the required reads and writes.
                </p>
              </div>
            ) : null}
            <ChatWindow
              conversation={activeConversation}
              messages={messages}
              currentUserId={currentUser?.uid}
              currentUserRole={userProfile?.role}
              onSend={handleSend}
              canSend={!chatLocked}
              lockedMessage={chatLockedMessage}
            />
          </div>
        </div>
      </section>
    </AppShell>
  );
};

export default ChatPage;
