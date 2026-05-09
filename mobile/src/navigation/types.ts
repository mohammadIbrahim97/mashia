export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: { phone?: string; code?: string } | undefined;
  RecoverAccess: undefined;
};

export type HomeStackParamList = {
  HomeFeed: undefined;
  ListingDetail: { listingId: string };
  PlaceOrder: { listingId: string; pricePerHead: number; currency: string };
  OrderConfirmation: { orderId: string };
  PaymentMethod: { orderId: string; totalPrice: number; currency: string };
  PaymentResult: { success: boolean; orderId: string };
  CertificateDetail: { certificateId: string };
};

export type OrdersStackParamList = {
  MyOrders: undefined;
  OrderDetail: { orderId: string };
  PaymentMethod: { orderId: string; totalPrice: number; currency: string };
  PaymentResult: { success: boolean; orderId: string };
};

export type ChatStackParamList = {
  Conversations: undefined;
  Chat: { conversationId: string; title: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  KycUpload: undefined;
  MyListings: undefined;
  CreateListing: { editId?: string } | undefined;
  ListingDetail: { listingId: string };
  UploadCertificate: { listingId: string };
  CertificateDetail: { certificateId: string };
};
