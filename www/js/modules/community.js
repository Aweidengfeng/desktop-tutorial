export function registerCommunityModule(app) {
  Object.assign(app, {
    async loadPosts() {
      this.postsLoading = true;
      try {
        const res = await fetch('/api/posts');
        if (!res.ok) return;
        const data = await res.json();
        this.communityPosts = data.map(p => ({
          ...p,
          author: p.authorName,
          authorAvatar: p.authorAvatar,
          timeAgo: p.createdAt ? new Date(p.createdAt).toLocaleDateString('zh-CN') : '最近',
          isLiked: false,
          isFavorited: false,
          commentPreview: [],
        }));
        this.filteredCommunityPosts = this.communityPosts;
      } catch(e) {} finally { this.postsLoading = false; }
    },

    async likePost(post) {
      if (!this.requireAuth()) return;
      const wasLiked = post.isLiked;
      post.isLiked = !wasLiked;
      post.likes += post.isLiked ? 1 : -1;
      try {
        const res = await fetch('/api/posts/' + post.id + '/like', {
          method: 'POST',
          headers: this.getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          post.isLiked = data.liked;
          post.likes = data.likes;
        } else {
          post.isLiked = wasLiked;
          post.likes += wasLiked ? 1 : -1;
        }
      } catch(e) {
        post.isLiked = wasLiked;
        post.likes += wasLiked ? 1 : -1;
      }
    },

    async createPost() {
      if (!this.requireAuth()) return;
      if (!this.newPost.content.trim() && this.newPost.images.length === 0 && !this.newPost.videoFile) return;
      try {
        let videoUrl = this.newPost.videoUrl || null;
        if (this.newPost.videoFile && !videoUrl) {
          const fd = new FormData();
          fd.append('file', this.newPost.videoFile);
          const vr = await fetch('/api/upload/video', { method: 'POST', headers: { Authorization: 'Bearer ' + this.authToken }, body: fd });
          if (vr.ok) { const vd = await vr.json(); videoUrl = vd.url; }
        }
        let imageUrls = this.newPost.images;
        const blobImages = imageUrls.filter(u => u.startsWith('blob:'));
        if (blobImages.length > 0) {
          const uploaded = await this.uploadImages(blobImages);
          imageUrls = [...imageUrls.filter(u => !u.startsWith('blob:')), ...uploaded];
        }
        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ content: this.newPost.content, location: this.newPost.location, images: imageUrls, image: imageUrls[0] || null, video_url: videoUrl, category: this.newPost.category || 'post' }),
        });
        const data = await res.json();
        if (!res.ok) { this.showToast(data.error || '发布失败', 'error'); return; }
        this.communityPosts.unshift({ ...data, author: data.authorName, timeAgo: '刚刚', isLiked: false, isFavorited: false, commentPreview: [] });
      } catch(e) {
        const imageUrls = this.newPost.images;
        this.communityPosts.unshift({ id: Date.now(), author: this.userProfile.name, authorAvatar: this.userProfile.avatar, timeAgo: '刚刚', content: this.newPost.content, image: imageUrls[0] || null, images: imageUrls, location: this.newPost.location || '', category: this.newPost.category || 'post', likes: 0, comments: 0, isLiked: false, isFavorited: false, commentPreview: [] });
      }
      this.newPost = { content: '', location: '', images: [], videoPreview: '', videoFile: null, videoUrl: '', category: 'post' };
      this.showPostEditor = false;
      this.showToast('发布成功！');
    },

    async toggleLike(post) {
      return this.likePost(post);
    },

    async submitPost() {
      return this.createPost();
    },
  });
}
