import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  SafeAreaView,
  Image,
  Animated,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Manager } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

const SOCKET_URL = 'http://192.168.23.229:5000';
const WEBRTC_URL = 'https://webrtc.github.io/samples/src/content/peerconnection/pc1/';

type CallScreenRouteProp = RouteProp<RootStackParamList, 'Call'>;

export const CallScreen = () => {
  const route = useRoute<CallScreenRouteProp>();
  const navigation = useNavigation();
  const [isCallConnected, setIsCallConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const socketRef = useRef<any>(null);
  const webViewRef = useRef<WebView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isVideoMode = route.params.mode === 'video';

  useEffect(() => {
    setupSocket();
    setupPulseAnimation();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isCallConnected) {
      startTimer();
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [isCallConnected]);

  const setupPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const setupSocket = async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      console.error('No token available for socket connection');
      return;
    }

    const manager = new Manager(`${SOCKET_URL}?token=${token}`, {
      autoConnect: false
    });

    socketRef.current = manager.socket('/');
    
    socketRef.current.on('connect', () => {
      console.log('Socket connected for call');
      socketRef.current.emit('call_request', {
        targetUserId: route.params.userId,
        mode: route.params.mode,
      });
    });

    socketRef.current.on('call_accepted', () => {
      setIsCallConnected(true);
    });

    socketRef.current.on('call_rejected', () => {
      Alert.alert('Call Rejected', 'The user rejected your call');
      navigation.goBack();
    });

    socketRef.current.on('call_ended', () => {
      Alert.alert('Call Ended', 'The other user ended the call');
      navigation.goBack();
    });

    socketRef.current.connect();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (isVideoMode && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        const audioTracks = window.localStream.getAudioTracks();
        audioTracks.forEach(track => track.enabled = ${isMuted});
        true;
      `);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const toggleVideo = () => {
    if (isVideoMode) {
      setIsVideoEnabled(!isVideoEnabled);
      webViewRef.current?.injectJavaScript(`
        const videoTracks = window.localStream.getVideoTracks();
        videoTracks.forEach(track => track.enabled = ${!isVideoEnabled});
        true;
      `);
    }
  };

  const endCall = () => {
    if (socketRef.current) {
      socketRef.current.emit('call_ended', {
        targetUserId: route.params.userId,
      });
    }
    navigation.goBack();
  };

  const onWebViewMessage = (event: any) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'webrtc_ready') {
      setIsCallConnected(true);
    }
  };

  const renderAudioCallUI = () => (
    <View style={styles.audioCallContainer}>
      <View style={styles.callerInfoContainer}>
        <Animated.View 
          style={[
            styles.avatarContainer,
            !isCallConnected && {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Icon name="person" size={80} color="#666" />
        </Animated.View>
        <Text style={styles.callerName}>{route.params.userId}</Text>
        <Text style={[
          styles.callStatus,
          isCallConnected && styles.callStatusConnected
        ]}>
          {isCallConnected ? 'Connected' : 'Calling...'}
        </Text>
        {isCallConnected && (
          <Text style={styles.callDuration}>
            {formatDuration(callDuration)}
          </Text>
        )}
      </View>

      <View style={styles.statusIndicators}>
        {isMuted && (
          <View style={styles.indicator}>
            <Icon name="mic-off" size={16} color="#FF3B30" />
            <Text style={styles.indicatorText}>Muted</Text>
          </View>
        )}
        {isSpeakerOn && (
          <View style={styles.indicator}>
            <Icon name="volume-up" size={16} color="#007AFF" />
            <Text style={styles.indicatorText}>Speaker On</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {isVideoMode ? (
        <View style={styles.videoContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: WEBRTC_URL }}
            style={styles.webview}
            onMessage={onWebViewMessage}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
          />
        </View>
      ) : (
        renderAudioCallUI()
      )}

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Icon
            name={isMuted ? 'mic-off' : 'mic'}
            size={24}
            color="white"
          />
          <Text style={styles.controlLabel}>
            {isMuted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>

        {isVideoMode && (
          <TouchableOpacity
            style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
            onPress={toggleVideo}
          >
            <Icon
              name={isVideoEnabled ? 'videocam' : 'videocam-off'}
              size={24}
              color="white"
            />
            <Text style={styles.controlLabel}>
              {isVideoEnabled ? 'Stop Video' : 'Start Video'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={endCall}
        >
          <Icon name="call-end" size={24} color="white" />
          <Text style={[styles.controlLabel, styles.endCallLabel]}>
            End
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={toggleSpeaker}
        >
          <Icon
            name={isSpeakerOn ? 'volume-up' : 'volume-down'}
            size={24}
            color="white"
          />
          <Text style={styles.controlLabel}>
            {isSpeakerOn ? 'Speaker' : 'Phone'}
          </Text>
        </TouchableOpacity>
      </View>

      {!isCallConnected && isVideoMode && (
        <View style={styles.callingOverlay}>
          <Text style={styles.callingText}>Calling...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#4a4a4a',
  },
  audioCallContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 40,
  },
  callerInfoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  callerName: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  callStatus: {
    color: '#FF9500',
    fontSize: 16,
    marginBottom: 5,
    fontWeight: '600',
  },
  callStatusConnected: {
    color: '#34C759',
  },
  callDuration: {
    color: '#999',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 10,
  },
  statusIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 6,
  },
  indicatorText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  controlButtonActive: {
    backgroundColor: '#007AFF',
  },
  controlLabel: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
  },
  endCallButton: {
    backgroundColor: '#FF3B30',
  },
  endCallLabel: {
    color: 'white',
  },
  callingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callingText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
}); 