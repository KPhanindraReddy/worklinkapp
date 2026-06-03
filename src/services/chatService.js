import { get, onValue, push, ref, set, update } from 'firebase/database';
import { isFirebaseConfigured } from '../firebase/env';
import { realtimeDatabase as rtdb } from '../firebase/realtimeDatabase';
import { parseDateValue } from '../utils/formatters';

export const buildConversationId = (userA, userB) => [userA, userB].sort().join('__');

const normalizeParticipantProfile = (profile = {}) => ({
  fullName: profile.fullName || profile.participantName || profile.name || 'WorkLink user',
  role: profile.role || profile.participantRole || '',
  phoneNumber: profile.phoneNumber || '',
  whatsAppLink: profile.whatsAppLink || ''
});

const sortByLastMessageAtDesc = (items) =>
  [...items].sort((a, b) => {
    const dateA = parseDateValue(a.lastMessageAt)?.getTime() ?? 0;
    const dateB = parseDateValue(b.lastMessageAt)?.getTime() ?? 0;

    return dateB - dateA;
  });

const sortByCreatedAtAsc = (items) =>
  [...items].sort((a, b) => {
    const dateA = Number(a.createdAt) || parseDateValue(a.createdAt)?.getTime() || 0;
    const dateB = Number(b.createdAt) || parseDateValue(b.createdAt)?.getTime() || 0;

    return dateA - dateB;
  });

const getConversationRef = (conversationId) => ref(rtdb, `conversations/${conversationId}`);
const getMessagesRef = (conversationId) => ref(rtdb, `messages/${conversationId}`);
const getUserConversationRef = (userId, conversationId) =>
  ref(rtdb, `userConversations/${userId}/${conversationId}`);
const getUserConversationsRef = (userId) => ref(rtdb, `userConversations/${userId}`);

const buildUserConversationSummary = ({
  conversationId,
  currentUserId,
  otherUserId,
  currentUserProfile,
  otherUserProfile,
  bookingId = '',
  lastMessage = '',
  lastMessageAt = null
}) => ({
  conversationId,
  otherUserId,
  participantIds: [currentUserId, otherUserId],
  displayName: otherUserProfile.fullName,
  displayRole: otherUserProfile.role,
  phoneNumber: otherUserProfile.phoneNumber,
  whatsAppLink: otherUserProfile.whatsAppLink,
  bookingId,
  lastMessage,
  lastMessageAt,
  online: false,
  typing: {},
  participantProfiles: {
    [currentUserId]: currentUserProfile,
    [otherUserId]: otherUserProfile
  }
});

export const subscribeConversations = (userId, onNext, onError) => {
  if (!userId) {
    onNext([]);
    return () => {};
  }

  if (!isFirebaseConfigured || !rtdb) {
    onNext([]);
    return () => {};
  }

  return onValue(
    getUserConversationsRef(userId),
    (snapshot) => {
      const conversations = snapshot.val() || {};
      onNext(
        sortByLastMessageAtDesc(
          Object.entries(conversations).map(([id, conversation]) => ({
            id,
            ...conversation
          }))
        )
      );
    },
    onError
  );
};

export const getMessages = async (conversationId) => {
  if (!conversationId) {
    return [];
  }

  if (!isFirebaseConfigured || !rtdb) {
    return [];
  }

  const snapshot = await get(getMessagesRef(conversationId));
  const messages = snapshot.val() || {};
  return sortByCreatedAtAsc(
    Object.entries(messages).map(([id, message]) => ({
      id,
      ...message
    }))
  );
};

export const subscribeMessages = (conversationId, onNext, onError) => {
  if (!conversationId) {
    onNext([]);
    return () => {};
  }

  if (!isFirebaseConfigured || !rtdb) {
    onNext([]);
    return () => {};
  }

  return onValue(
    getMessagesRef(conversationId),
    (snapshot) => {
      const messages = snapshot.val() || {};
      onNext(
        sortByCreatedAtAsc(
          Object.entries(messages).map(([id, message]) => ({
            id,
            ...message
          }))
        )
      );
    },
    onError
  );
};

export const ensureConversation = async ({ currentUserId, otherUserId, metadata = {} }) => {
  if (!currentUserId || !otherUserId) {
    throw new Error('Conversation participants are required.');
  }

  if (!isFirebaseConfigured || !rtdb) {
    throw new Error('Firebase must be configured before starting chats.');
  }

  const conversationId = buildConversationId(currentUserId, otherUserId);
  const conversationRef = getConversationRef(conversationId);
  const snapshot = await get(conversationRef);
  const {
    currentUserProfile,
    otherUserProfile,
    participantName,
    participantRole,
    phoneNumber,
    whatsAppLink,
    ...restMetadata
  } = metadata;
  const normalizedCurrentUserProfile = normalizeParticipantProfile(currentUserProfile);
  const normalizedOtherUserProfile = normalizeParticipantProfile({
    ...otherUserProfile,
    participantName,
    participantRole,
    phoneNumber,
    whatsAppLink
  });
  const conversationPayload = {
    participantIds: {
      [currentUserId]: true,
      [otherUserId]: true
    },
    participantProfiles: {
      [currentUserId]: normalizedCurrentUserProfile,
      [otherUserId]: normalizedOtherUserProfile
    },
    participantName: normalizedOtherUserProfile.fullName,
    participantRole: normalizedOtherUserProfile.role,
    phoneNumber: normalizedOtherUserProfile.phoneNumber,
    whatsAppLink: normalizedOtherUserProfile.whatsAppLink,
    ...restMetadata
  };

  if (!snapshot.exists()) {
    await set(conversationRef, {
      ...conversationPayload,
      lastMessage: '',
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      typing: {},
      readBy: {}
    });
  } else {
    await update(conversationRef, {
      participantProfiles: conversationPayload.participantProfiles,
      participantName: conversationPayload.participantName,
      participantRole: conversationPayload.participantRole,
      phoneNumber: conversationPayload.phoneNumber,
      whatsAppLink: conversationPayload.whatsAppLink,
      ...restMetadata,
      updatedAt: Date.now()
    });
  }

  const existingConversation = snapshot.val() || {};
  const existingLastMessage = existingConversation.lastMessage || '';
  const existingLastMessageAt = existingConversation.lastMessageAt || Date.now();
  const userConversationPayload = buildUserConversationSummary({
    conversationId,
    currentUserId,
    otherUserId,
    currentUserProfile: normalizedCurrentUserProfile,
    otherUserProfile: normalizedOtherUserProfile,
    bookingId: restMetadata.bookingId || '',
    lastMessage: existingLastMessage,
    lastMessageAt: existingLastMessageAt
  });
  const reverseUserConversationPayload = buildUserConversationSummary({
    conversationId,
    currentUserId: otherUserId,
    otherUserId: currentUserId,
    currentUserProfile: normalizedOtherUserProfile,
    otherUserProfile: normalizedCurrentUserProfile,
    bookingId: restMetadata.bookingId || '',
    lastMessage: existingLastMessage,
    lastMessageAt: existingLastMessageAt
  });

  await Promise.all([
    set(getUserConversationRef(currentUserId, conversationId), userConversationPayload),
    set(getUserConversationRef(otherUserId, conversationId), reverseUserConversationPayload)
  ]);

  return conversationId;
};

export const sendMessage = async (conversationId, payload) => {
  if (!conversationId) {
    throw new Error('Conversation id is required.');
  }

  if (!isFirebaseConfigured || !rtdb) {
    throw new Error('Firebase must be configured before sending chat messages.');
  }

  const messageRef = push(getMessagesRef(conversationId));
  const createdAt = Date.now();
  const messagePayload = {
    ...payload,
    createdAt
  };

  await set(messageRef, messagePayload);

  const conversationSnapshot = await get(getConversationRef(conversationId));
  const conversation = conversationSnapshot.val() || {};
  const participantIds = Object.keys(conversation.participantIds || {});
  const updates = {
    [`conversations/${conversationId}/lastMessage`]: payload.text || 'Image',
    [`conversations/${conversationId}/lastMessageAt`]: createdAt,
    [`conversations/${conversationId}/updatedAt`]: createdAt,
    [`conversations/${conversationId}/readBy/${payload.senderId}`]: true,
    [`conversations/${conversationId}/readBy/${payload.recipientId}`]: false
  };

  participantIds.forEach((uid) => {
    updates[`userConversations/${uid}/${conversationId}/lastMessage`] = payload.text || 'Image';
    updates[`userConversations/${uid}/${conversationId}/lastMessageAt`] = createdAt;
    updates[`userConversations/${uid}/${conversationId}/updatedAt`] = createdAt;
    updates[`userConversations/${uid}/${conversationId}/readBy/${payload.senderId}`] = true;
    updates[`userConversations/${uid}/${conversationId}/readBy/${payload.recipientId}`] = false;
  });

  await update(ref(rtdb), updates);
};
