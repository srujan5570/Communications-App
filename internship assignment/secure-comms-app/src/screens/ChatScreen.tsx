import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { Manager } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../../App';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialIcons';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

interface Message {
  _id: string;
  content: string;
  sender: string;
  receiver: string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
}

interface MessageStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read';
}

const API_URL = 'http://192.168.23.229:5000/api';
const SOCKET_URL = 'http://192.168.23.229:5000';

export const ChatScreen = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string>('');
  const socketRef = useRef<any>();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setupSocket();
    fetchMessages();
    setupHeaderButtons();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const setupHeaderButtons = () => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Call', { mode: 'voice', userId: route.params.userId })}
          >
            <Icon name="call" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Call', { mode: 'video', userId: route.params.userId })}
          >
            <Icon name="videocam" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      ),
    });
  };

  const setupSocket = async () => {
    const token = await AsyncStorage.getItem('userToken');
    const userData = await AsyncStorage.getItem('userData');
    
    console.log('Setting up socket connection...');
    console.log('Token available:', !!token);
    console.log('User data available:', !!userData);
    
    if (userData) {
      const user = JSON.parse(userData);
      setUserId(user.id);
      console.log('User ID set:', user.id);
    }

    if (!token) {
      console.error('No token available for socket connection');
      return;
    }

    // Create socket manager with token in URL
    const manager = new Manager(`${SOCKET_URL}?token=${token}`, {
      autoConnect: false
    });

    socketRef.current = manager.socket('/');
    
    // Add connection event listeners
    socketRef.current.on('connect', () => {
      console.log('Socket connected successfully');
    });

    socketRef.current.on('connect_error', (error: any) => {
      console.error('Socket connection error:', error.message);
      console.error('Socket connection error details:', error);
    });

    socketRef.current.on('error', (error: any) => {
      console.error('Socket error:', error);
    });

    socketRef.current.on('message_sent', (message: any) => {
      console.log('Message sent confirmation received:', message);
      // Update the optimistic message with the real one
      setMessages(prev => 
        prev.map(msg => 
          msg.content === message.content && msg.sender === message.sender ? 
          message : msg
        )
      );
    });

    socketRef.current.on('message_error', (error: any) => {
      console.error('Message error received:', error);
    });

    socketRef.current.connect();

    socketRef.current.on('new_message', (message: Message) => {
      if (message.sender === route.params.userId) {
        setMessages(prev => [...prev, message]);
        // Mark message as delivered
        socketRef.current?.emit('mark_delivered', { messageId: message._id });
        // Scroll to bottom for new messages
        if (flatListRef.current) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    });

    socketRef.current.on('message_status', ({ messageId, status }: MessageStatus) => {
      setMessages(prev =>
        prev.map(msg =>
          msg._id === messageId ? { ...msg, status } : msg
        )
      );
    });
  };

  const fetchMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(
        `${API_URL}/chat/messages/${route.params.userId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // Sort messages by date in ascending order
      const sortedMessages = response.data.sort((a: Message, b: Message) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setMessages(sortedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !socketRef.current) return;

    console.log('Attempting to send message:', {
      receiverId: route.params.userId,
      content: newMessage.trim()
    });

    socketRef.current.emit('private_message', {
      receiverId: route.params.userId,
      content: newMessage.trim(),
    });

    // Add optimistic message to the UI
    const optimisticMessage: Message = {
      _id: Date.now().toString(), // Temporary ID
      content: newMessage.trim(),
      sender: userId,
      receiver: route.params.userId,
      status: 'sent',
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMessage]);
    console.log('Message emitted to socket');
    setNewMessage('');

    // Scroll to bottom after sending
    if (flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender === userId;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <Text style={[
          styles.messageText,
          !isOwnMessage && styles.otherMessageText,
        ]}>
          {item.content}
        </Text>
        <Text style={[
          styles.messageTime,
          !isOwnMessage && styles.otherMessageTime,
        ]}>
          {new Date(item.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {isOwnMessage && (
            <Text style={styles.statusText}>
              {' '}• {item.status}
            </Text>
          )}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.messagesList}
        inverted={false}
        ref={(ref) => {
          if (ref) {
            // Scroll to bottom when new messages arrive
            ref.scrollToEnd({ animated: true });
          }
        }}
        onContentSizeChange={() => {
          // Scroll to bottom when content size changes (new messages)
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          multiline
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !newMessage.trim() && styles.sendButtonDisabled,
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderTopRightRadius: 4,
    marginLeft: '20%',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderTopLeftRadius: 4,
    marginRight: '20%',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  otherMessageText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  otherMessageTime: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  statusText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    marginRight: 10,
  },
  headerButton: {
    marginLeft: 15,
  },
}); 