import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

type ChatListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatList'>;

type ChatScreenParams = {
  userId: string;
  userName: string;
};

interface User {
  _id: string;
  username: string;
  email: string;
}

const API_URL = 'http://192.168.23.229:5000/api';

interface Props {
  navigation: ChatListScreenNavigationProp;
}

export const ChatListScreen: React.FC<Props> = ({ navigation }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        navigation.navigate('Login');
        return;
      }
      const response = await axios.get(`${API_URL}/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Raw API response:', response.data);
      
      // Map and validate users, handling both name and username fields
      const validUsers = response.data
        .filter((user: any) => {
          if (!user._id || (!user.username && !user.name)) {
            console.error('Invalid user data:', user);
            return false;
          }
          return true;
        })
        .map((user: any) => ({
          _id: user._id,
          username: user.username || user.name, // Use username if available, otherwise use name
          email: user.email
        }));

      console.log('Mapped users:', validUsers);
      setUsers(validUsers);
      setFilteredUsers(validUsers);
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const navigateToChat = (userId: string, username: string) => {
    console.log('Navigating to chat with:', { userId, username });
    if (!userId || !username) {
      console.error('Invalid user data for chat navigation:', { userId, username });
      Alert.alert('Error', 'Invalid user data');
      return;
    }
    
    // Navigate to chat with user data
    navigation.navigate('Chat', {
      userId,
      userName: username
    });
  };

  const renderItem = ({ item }: { item: User }) => {
    console.log('Rendering user item:', item);
    if (!item._id || !item.username) {
      console.error('Invalid user data in list item:', item);
      return null;
    }
    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => navigateToChat(item._id, item.username)}
      >
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.username}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#666666" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0084ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Icon name="search" size={24} color="#999999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor="#999999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close" size={20} color="#999999" />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={filteredUsers}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    margin: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#404040',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
    fontSize: 16,
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  userItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    color: '#999999',
    fontSize: 14,
  },
}); 