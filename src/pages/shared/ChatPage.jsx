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
  sendMessage,
  subscribeConversations,
  subscribeMessages
} from '../../services/chatService';
import { getLabourById } from '../../services/labourService';
import { createNotification } from '../../services/notificationService';
import { getUserProfile } from '../../services/userService';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';

const decorateConversationForUser = (conversation, currentUserId) => {
  const otherUserId = conversation.participantIds?.find((id) => id !== currentUserId);
  const otherProfile = otherUserId ? conversation.participantProfiles?.[otherUserId] : null;

  return {
    ...conversation,
    otherUserId,
    displayName: otherProfile?.fullName || conversation.participantName || 'WorkLink user',
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

  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      setActiveConversation(null);
      return undefined;
    }

    return subscribeConversations(
      currentUser.uid,
      (items) => {
        setConversations(items.map((item) => decorateConversationForUser(item, currentUser.uid)));
      },
      (error) => toast.error(getFirebaseErrorMessage(error))
    );
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser || !targetUserId) {
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
              role: otherProfile?.role || otherProfile?.category || 'WorkLink user',
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
      })
      .catch((error) => toast.error(getFirebaseErrorMessage(error)));

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
  }, [conversations, targetConversationId, targetUserId]);

  useEffect(() => {
    if (!activeConversation?.id) {
      setMessages([]);
      return undefined;
    }

    return subscribeMessages(
      activeConversation.id,
      setMessages,
      (error) => toast.error(getFirebaseErrorMessage(error))
    );
  }, [activeConversation?.id]);

  const handleSend = async (text) => {
    if (!activeConversation || !currentUser) {
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
        await createNotification({
          userId: recipientId,
          senderId: currentUser.uid,
          bookingId: activeConversation.bookingId,
          type: 'chat',
          title: `New message from ${userProfile?.fullName || 'WorkLink user'}`,
          body: text.length > 120 ? `${text.slice(0, 117)}...` : text,
          conversationId: activeConversation.id
        });
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
          <ChatWindow
            conversation={activeConversation}
            messages={messages}
            currentUserId={currentUser?.uid}
            onSend={handleSend}
          />
        </div>
      </section>
    </AppShell>
  );
};

export default ChatPage;
