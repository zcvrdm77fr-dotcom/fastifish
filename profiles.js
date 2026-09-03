import express from 'express';
import { db } from './db.js';

const router = express.Router();
const USERNAME_RE = /^[a-zA-Z0-9äöåÄÖÅ_-]{3,20}$/;

router.get('/:username', (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Virheellinen käyttäjänimi.' });
  }

  const user = db.prepare(`
    SELECT id, username, created_at
    FROM users
    WHERE username = ? COLLATE NOCASE
  `).get(username);

  if (!user) return res.status(404).json({ error: 'Käyttäjää ei löytynyt.' });

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS post_count,
      COALESCE(MAX(weight_g), 0) AS max_weight_g,
      COALESCE(MAX(length_cm), 0) AS max_length_cm,
      COUNT(DISTINCT CASE WHEN species IS NOT NULL AND species != '' THEN species END) AS species_count
    FROM posts
    WHERE user_id = ? AND status = 'published'
  `).get(user.id);

  const social = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM likes JOIN posts ON posts.id = likes.post_id WHERE posts.user_id = ? AND posts.status = 'published') AS likes_received,
      (SELECT COUNT(*) FROM comments JOIN posts ON posts.id = comments.post_id WHERE posts.user_id = ? AND posts.status = 'published') AS comments_received
  `).get(user.id, user.id);

  const topSpecies = db.prepare(`
    SELECT species, COUNT(*) AS catches
    FROM posts
    WHERE user_id = ? AND status = 'published' AND species IS NOT NULL AND species != ''
    GROUP BY species
    ORDER BY catches DESC, species ASC
    LIMIT 5
  `).all(user.id);

  const topLures = db.prepare(`
    SELECT lure, COUNT(*) AS catches
    FROM posts
    WHERE user_id = ? AND status = 'published' AND lure IS NOT NULL AND lure != ''
    GROUP BY lure
    ORDER BY catches DESC, lure ASC
    LIMIT 5
  `).all(user.id);

  const recentPosts = db.prepare(`
    SELECT id, caption, species, weight_g, length_cm, catch_location, lure, image_path, created_at
    FROM posts
    WHERE user_id = ? AND status = 'published'
    ORDER BY id DESC
    LIMIT 12
  `).all(user.id).map(post => ({
    id: post.id,
    caption: post.caption || '',
    species: post.species || null,
    weightKg: post.weight_g === null ? null : post.weight_g / 1000,
    lengthCm: post.length_cm === null ? null : post.length_cm,
    catchLocation: post.catch_location || null,
    lure: post.lure || null,
    imageUrl: `/uploads/${post.image_path}`,
    createdAt: post.created_at
  }));

  res.json({
    profile: {
      username: user.username,
      joinedAt: user.created_at,
      postCount: stats.post_count,
      speciesCount: stats.species_count,
      biggestWeightKg: stats.max_weight_g ? stats.max_weight_g / 1000 : null,
      longestFishCm: stats.max_length_cm || null,
      likesReceived: social.likes_received || 0,
      commentsReceived: social.comments_received || 0,
      topSpecies,
      topLures,
      recentPosts
    }
  });
});

export default router;
