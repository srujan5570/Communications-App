import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import io, { Socket } from 'socket.io-client';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;

interface Message {
  _id: string;
  content: string;
  sender: { _id: string } | string;
  receiver: { _id: string } | string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  updatedAt: string;
}

interface User {
  _id: string;
  username: string;
  email: string;
}

const API_URL = 'http://192.168.23.229:5000/api';
const SOCKET_URL = 'http://192.168.23.229:5000';

// Helper function to get ID from sender/receiver
const getId = (field: { _id: string } | string): string => {
  return typeof field === 'string' ? field : field._id;
};

export const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  
  // Destructure and validate route params
  const { userId, userName } = route.params || {};
  
  if (!userId || !userName) {
    console.error('Missing required params:', { userId, userName });
    // If we're missing params, redirect to ChatList
    React.useEffect(() => {
      navigation.replace('ChatList');
    }, []);
    return null;
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isUserOnline, setIsUserOnline] = useState(false);
  const flatListRef = React.useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({
      title: userName,
      headerTitle: () => (
        <View style={styles.headerTitle}>
          <Text style={styles.headerUsername}>{userName}</Text>
          <Text style={[styles.headerStatus, { color: isUserOnline ? '#4CAF50' : '#FF5252' }]}>
            {isUserOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      ),
    });
  }, [navigation, userName, isUserOnline]);

  useEffect(() => {
    const setupSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const currentUser = await AsyncStorage.getItem('userData');
        console.log('Current user data:', currentUser);
        
        if (!token || !currentUser) {
          navigation.navigate('Login');
          return;
        }

        const userData = JSON.parse(currentUser);
        const formattedUser: User = {
          _id: userData.id,
          username: userData.username,
          email: userData.email
        };
        setUser(formattedUser);

        const newSocket = io(SOCKET_URL, {
          auth: {
            token,
          },
        });

        newSocket.on('connect', () => {
          console.log('Connected to socket server');
        });

        newSocket.on('userOnline', (onlineUserId: string) => {
          if (onlineUserId === userId) {
            setIsUserOnline(true);
          }
        });

        newSocket.on('userOffline', (offlineUserId: string) => {
          if (offlineUserId === userId) {
            setIsUserOnline(false);
          }
        });

        // Handle new incoming messages
        newSocket.on('new_message', (message: Message) => {
          console.log('Received new message:', message);
          // Format the message to match our Message interface
          const formattedMessage = {
            ...message,
            sender: typeof message.sender === 'string' 
              ? { _id: message.sender }
              : message.sender,
            receiver: typeof message.receiver === 'string'
              ? { _id: message.receiver }
              : message.receiver
          };
          
          setMessages(prevMessages => {
            // Check if message already exists
            const exists = prevMessages.some(m => m._id === message._id);
            if (exists) return prevMessages;
            return [...prevMessages, formattedMessage];
          });
        });

        // Handle message sent confirmation
        newSocket.on('message_sent', (message: Message) => {
          console.log('Message sent confirmation:', message);
          // Format the message to match our Message interface
          const formattedMessage = {
            ...message,
            sender: typeof message.sender === 'string' 
              ? { _id: message.sender }
              : message.sender,
            receiver: typeof message.receiver === 'string'
              ? { _id: message.receiver }
              : message.receiver
          };

          setMessages(prevMessages => {
            // Replace temporary message with confirmed one
            const updatedMessages = prevMessages.filter(msg => {
              const msgSenderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
              const msgReceiverId = typeof msg.receiver === 'object' ? msg.receiver._id : msg.receiver;
              const newSenderId = typeof message.sender === 'string' ? message.sender : message.sender._id;
              const newReceiverId = typeof message.receiver === 'string' ? message.receiver : message.receiver._id;
              
              return !(msg.content === message.content && 
                      msgSenderId === newSenderId &&
                      msgReceiverId === newReceiverId);
            });
            return [...updatedMessages, formattedMessage];
          });
        });

        // Handle message status updates
        newSocket.on('message_status', ({ messageId, status }: { messageId: string, status: 'sent' | 'delivered' | 'read' }) => {
          console.log('Message status update:', { messageId, status });
          setMessages(prevMessages => 
            prevMessages.map(msg =>
              msg._id === messageId 
                ? { ...msg, status }
                : msg
            )
          );
        });

        newSocket.on('error', (error: any) => {
          console.error('Socket error:', error);
          Alert.alert('Error', 'Failed to send/receive message');
        });

        setSocket(newSocket);

        return () => {
          newSocket.disconnect();
        };
      } catch (error) {
        console.error('Socket setup error:', error);
        Alert.alert('Error', 'Failed to connect to chat server');
      }
    };

    setupSocket();
  }, [userId, navigation]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) {
          navigation.navigate('Login');
          return;
        }

        const response = await fetch(`${API_URL}/chat/messages/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Fetched messages:', data);
        // Sort messages by timestamp
        const sortedMessages = data.sort((a: Message, b: Message) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setMessages(sortedMessages);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        Alert.alert('Error', 'Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [userId, navigation]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !socket || !user) return;

    // Declare tempMessage ID outside try block so it's accessible in catch
    const tempMessageId = Date.now().toString();
    const content = newMessage.trim();

    try {
      const timestamp = new Date().toISOString();
      
      // Create a temporary message for immediate display
      const tempMessage: Message = {
        _id: tempMessageId,
        content: content,
        sender: {
          _id: user._id
        },
        receiver: {
          _id: userId
        },
        status: 'sent',
        createdAt: timestamp,
        updatedAt: timestamp
      };

      // Clear input before sending to prevent double-sending
      setNewMessage('');

      // Add message to state immediately for better UX
      setMessages(prevMessages => [...prevMessages, tempMessage]);

      // Send message through socket
      socket.emit('private_message', {
        receiverId: userId,
        content: content
      }, (error: any) => {
        if (error) {
          console.error('Failed to send message:', error);
          Alert.alert('Error', 'Failed to send message');
          // Remove the temporary message
          setMessages(prevMessages => 
            prevMessages.filter(msg => msg._id !== tempMessageId)
          );
        } else {
          console.log('Message sent successfully, waiting for server confirmation');
        }
      });

    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message');
      // Remove the temporary message if failed
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg._id !== tempMessageId)
      );
      // Restore the message text in case of error
      setNewMessage(content);
    }
  }, [newMessage, userId, socket, user]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = getId(item.sender) === user?._id;

    // Format timestamp
    let formattedTime = '';
    try {
      const date = new Date(item.createdAt);
      formattedTime = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // Use 24-hour format
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      formattedTime = 'Unknown time';
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <Text style={isOwnMessage ? styles.ownMessageText : styles.otherMessageText}>
          {item.content}
        </Text>
        <Text style={isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp}>
          {formattedTime}
        </Text>
      </View>
    );
  };

  // Add this function to scroll to bottom
  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  // Add effect to scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0084ff" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={scrollToBottom}
        onLayout={scrollToBottom}
        inverted={false}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor="#999999"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <Icon
            name="send"
            size={24}
            color={newMessage.trim() ? '#0084ff' : '#666666'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  messagesList: {
    flexGrow: 1,
    padding: 16,
    flexDirection: 'column',
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 4,
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8E8E8',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  ownMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#000000',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimestamp: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    color: '#000000',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  headerTitle: {
    alignItems: 'center',
  },
  headerUsername: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '600',
  },
  headerStatus: {
    fontSize: 12,
    marginTop: 2,
  },
}); 