export interface IProviderAdapter {
  fetchComments(): Promise<any[]>;
  postReply(externalCommentId: string, content: string): Promise<{ success: boolean; externalReplyId: string }>;
}

export class TwitterAdapter implements IProviderAdapter {
  constructor(private config: any) {}

  async fetchComments() {
    return [
      { externalId: 'tw-101', content: 'Love this product!', author: '@user1' },
      { externalId: 'tw-102', content: 'How much does it cost?', author: '@user2' },
    ];
  }

  async postReply(externalCommentId: string, content: string) {
    return { success: true, externalReplyId: `tw-reply-${Date.now()}` };
  }
}

export class FacebookAdapter implements IProviderAdapter {
  constructor(private config: any) {}

  async fetchComments() {
    return [
      { externalId: 'fb-201', content: 'Great service.', author: 'John Doe' },
    ];
  }

  async postReply(externalCommentId: string, content: string) {
    return { success: true, externalReplyId: `fb-reply-${Date.now()}` };
  }
}

export function getProviderAdapter(providerName: string, config: any): IProviderAdapter {
  switch (providerName.toLowerCase()) {
    case 'twitter':
      return new TwitterAdapter(config);
    case 'facebook':
      return new FacebookAdapter(config);
    default:
      throw new Error(`Unsupported provider: ${providerName}`);
  }
}