export interface Message {
  _id: string;
  content: string;
  sender: {
    _id: string;
    name: string;
  };
  receiver: string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
}

export interface MessageStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read';
} 