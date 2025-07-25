import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { 
  getUserStats, 
  getUserRanking, 
  getServerStats, 
  calculateUploadFrequency,
  getTopUsers,
  refreshServerStats,
  getWeeklyTopUsers,
  getDaysUntilReset,
  getWeekIdentifier,
  getUserWeeklyStats,
  getWeeklySummary
} from '../utils/statsManager.js';
import { runMigrationSafely, checkMigrationStatus } from '../utils/statsMigration.js';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Display gallery statistics and server rankings')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to show stats for (defaults to you)')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Type of stats to display')
      .setRequired(false)
      .addChoices(
        { name: 'Personal Stats', value: 'personal' },
        { name: 'Server Rankings', value: 'rankings' },
        { name: 'Leaderboard', value: 'leaderboard' },
        { name: 'Server Overview', value: 'server' },
        { name: 'Admin: Migrate Existing Data', value: 'migrate' },
        { name: 'Admin: Refresh Server Stats', value: 'refresh' }
      ));

export async function execute(interaction) {
  await interaction.deferReply();
  
  try {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const statsType = interaction.options.getString('type') || 'personal';
    
    switch (statsType) {
      case 'personal':
        await showPersonalStats(interaction, targetUser);
        break;
      case 'rankings':
        await showRankings(interaction, targetUser);
        break;
      case 'leaderboard':
        await showLeaderboard(interaction);
        break;
      case 'server':
        await showServerStats(interaction);
        break;
      case 'migrate':
        await runMigration(interaction);
        break;
      case 'refresh':
        await refreshStats(interaction);
        break;
      default:
        await showPersonalStats(interaction, targetUser);
    }
    
  } catch (error) {
    console.error('Error in stats command:', error);
    await interaction.editReply('❌ Failed to fetch statistics. Please try again later.');
  }
}

async function showPersonalStats(interaction, user) {
  const [userStats, userWeeklyStats] = await Promise.all([
    getUserStats(user.id),
    getUserWeeklyStats(user.id)
  ]);
  
  if (!userStats) {
    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('📊 No Statistics Found')
      .setDescription(`${user.displayName || user.username} hasn't uploaded any images yet!`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }));
    
    return interaction.editReply({ embeds: [embed] });
  }
  
  const uploadFreq = calculateUploadFrequency(userStats);
  const serverStats = await getServerStats();
  
  // Calculate some interesting metrics
  const daysSinceFirst = userStats.firstUpload ? 
    Math.ceil((Date.now() - userStats.firstUpload) / (1000 * 60 * 60 * 24)) : 0;
  const daysSinceLast = userStats.lastUpload ? 
    Math.ceil((Date.now() - userStats.lastUpload) / (1000 * 60 * 60 * 24)) : 0;
  
  // Format file size
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };
  
  // Get top content type
  const topContentType = userStats.contentTypes ? 
    Object.entries(userStats.contentTypes).sort(([,a], [,b]) => b - a)[0] : null;
  
  const embed = new EmbedBuilder()
    .setColor(0x4A90E2)
    .setTitle(`📊 Gallery Stats for ${userStats.displayName || userStats.username}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { 
        name: '📸 Upload Count', 
        value: `**${userStats.uploadCount.toLocaleString()}** images`, 
        inline: true 
      },
      { 
        name: '💾 Total Storage', 
        value: formatBytes(userStats.totalSize), 
        inline: true 
      },
      { 
        name: '🕒 Last Upload', 
        value: `${daysSinceLast} days ago`, 
        inline: true 
      },
      { 
        name: '⚡ Upload Frequency', 
        value: uploadFreq > 0 ? `${uploadFreq.toFixed(2)} images/day` : 'N/A', 
        inline: true 
      }
    );
  
  // Add weekly stats if available
  if (userWeeklyStats) {
    embed.addFields(
      {
        name: '📅 This Week',
        value: `**${userWeeklyStats.uploadCount}** uploads`,
        inline: true
      }
    );
  }
  
  if (topContentType) {
    embed.addFields({
      name: '🎨 Favorite Format',
      value: `${topContentType[0]} (${topContentType[1]} images)`,
      inline: true
    });
  }
  
  // Add comparison to server average
  if (serverStats.avgImagesPerUser > 0) {
    const vsAverage = ((userStats.uploadCount / serverStats.avgImagesPerUser - 1) * 100);
    embed.addFields({
      name: '📊 vs Server Average',
      value: vsAverage > 0 ? 
        `+${vsAverage.toFixed(1)}% above average` : 
        `${Math.abs(vsAverage).toFixed(1)}% below average`,
      inline: true
    });
  }
  
  embed.setFooter({ 
    text: `Use /stats type:rankings to see server rankings • Updated ${new Date(userStats.lastUpdated).toLocaleDateString()}` 
  });
  
  await interaction.editReply({ embeds: [embed] });
}

async function showRankings(interaction, user) {
  const [uploadRanking, userStats] = await Promise.all([
    getUserRanking(user.id, 'uploadCount'),
    getUserStats(user.id)
  ]);
  
  if (!userStats) {
    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('📊 No Rankings Available')
      .setDescription(`${user.displayName || user.username} hasn't uploaded any images yet!`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }));
    
    return interaction.editReply({ embeds: [embed] });
  }
  
  const uploadFreq = calculateUploadFrequency(userStats);
  
  // Calculate frequency ranking manually
  const allUsers = await getTopUsers('uploadCount', 1000); // Get enough for frequency calc
  const frequencyRankings = allUsers
    .map(u => ({ ...u, frequency: calculateUploadFrequency(u) }))
    .sort((a, b) => b.frequency - a.frequency);
  
  const freqRank = frequencyRankings.findIndex(u => u.userId === user.id) + 1;
  const freqPercentile = freqRank > 0 && frequencyRankings.length > 0 ? 
    Math.round((1 - (freqRank - 1) / frequencyRankings.length) * 100) : 0;
  
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`🏆 Server Rankings for ${userStats.displayName || userStats.username}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      {
        name: '📸 Upload Count Ranking',
        value: `**#${uploadRanking.rank}** out of ${uploadRanking.total} users\n` +
               `**${uploadRanking.value.toLocaleString()}** uploads (${uploadRanking.percentile}th percentile)`,
        inline: false
      },
      {
        name: '⚡ Upload Frequency Ranking',
        value: uploadFreq > 0 && freqRank > 0 ? 
               `**#${freqRank}** out of ${frequencyRankings.length} active users\n` +
               `**${uploadFreq.toFixed(2)}** images/day (${freqPercentile}th percentile)` :
               'Not enough data (need 2+ uploads)',
        inline: false
      }
    );
  
  // Add achievement-style descriptions
  if (uploadRanking.percentile >= 95) {
    embed.addFields({ name: '🌟 Achievement', value: '**Gallery Legend** - Top 5% uploader!', inline: false });
  } else if (uploadRanking.percentile >= 80) {
    embed.addFields({ name: '🌟 Achievement', value: '**Power User** - Top 20% uploader!', inline: false });
  } else if (uploadRanking.percentile >= 50) {
    embed.addFields({ name: '🌟 Achievement', value: '**Active Member** - Above average!', inline: false });
  }
  
  embed.setFooter({ 
    text: `Use /stats type:leaderboard to see top users • Rankings update in real-time` 
  });
  
  await interaction.editReply({ embeds: [embed] });
}

async function showLeaderboard(interaction) {
  const [topUploaders, weeklyTopUsers] = await Promise.all([
    getTopUsers('uploadCount', 5),
    getWeeklyTopUsers(5)
  ]);
  
  const daysUntilReset = getDaysUntilReset();
  // Format - 2025-W04
  const currentWeek = getWeekIdentifier();
  
  const embed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle('🏆 Gallery Leaderboards')
    //TODO Should it not show the current week? It's wrong anyway
    .setDescription(`Weekly stats reset in **${Math.round(daysUntilReset)} days**`);
  
  // Weekly top uploaders
  if (weeklyTopUsers.length > 0) {
    const weeklyUploadersText = weeklyTopUsers.map((user, index) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index] || `${index + 1}️⃣`;
      return `${medal} **${user.displayName || user.username}** - ${user.uploadCount.toLocaleString()} uploads`;
    }).join('\n');
    
    embed.addFields({
      name: '📸 This Week\'s Top Uploaders',
      value: weeklyUploadersText,
      inline: false
    });
  } else {
    embed.addFields({
      name: '📸 This Week\'s Top Uploaders',
      value: 'No uploads this week yet! Be the first to upload! 🎯',
      inline: false
    });
  }
  
  // All-time top uploaders (smaller section)
  if (topUploaders.length > 0) {
    const allTimeText = topUploaders.map((user, index) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index] || `${index + 1}️⃣`;
      return `${medal} **${user.displayName || user.username}** - ${user.uploadCount.toLocaleString()} uploads`;
    }).join('\n');
    
    embed.addFields({
      name: '🏆 All-Time Champions',
      value: allTimeText,
      inline: false
    });
  }
  
  embed.setFooter({ 
    text: `Weekly leaderboard resets every Monday • Use /stats type:server for overall statistics` 
  });
  
  await interaction.editReply({ embeds: [embed] });
}

async function showServerStats(interaction) {
  const [serverStats, weeklySummary] = await Promise.all([
    getServerStats(),
    getWeeklySummary()
  ]);
  
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };
  
  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('🌐 Server Gallery Overview')
    .setDescription('Complete statistics for this server\'s gallery')
    .addFields(
      {
        name: '👥 Total Users',
        value: `**${serverStats.totalUsers.toLocaleString()}** contributors`,
        inline: true
      },
      {
        name: '📸 Total Images',
        value: `**${serverStats.totalImages.toLocaleString()}** uploads`,
        inline: true
      },
      {
        name: '📊 Average per User',
        value: `**${serverStats.avgImagesPerUser}** images`,
        inline: true
      },
      {
        name: '📈 Median Uploads',
        value: `**${serverStats.medianUploads}** per user`,
        inline: true
      }
    );
  
  // Add weekly stats if available
  if (weeklySummary) {
    embed.addFields(
      {
        name: '📅 This Week',
        value: `**${weeklySummary.totalUploads}** uploads by **${weeklySummary.totalUsers}** users`,
        inline: true
      }
    );
  }
  
  // Add content type breakdown
  if (serverStats.contentTypeStats) {
    const topTypes = Object.entries(serverStats.contentTypeStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => `**${type}**: ${count.toLocaleString()}`)
      .join('\n');
    
    embed.addFields({
      name: '🎨 Content Types',
      value: topTypes,
      inline: false
    });
  }
  
  embed.setFooter({ 
    text: `Last updated: ${new Date(serverStats.lastUpdated).toLocaleString()}` 
  });
  
  await interaction.editReply({ embeds: [embed] });
}

async function runMigration(interaction) {
  // Check if user has admin permissions (you may want to adjust this check)
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('❌ Access Denied')
      .setDescription('This command requires administrator permissions.');
    
    return interaction.editReply({ embeds: [embed] });
  }
  
  try {
    const status = await checkMigrationStatus();
    
    if (status.hasRun) {
      const embed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle('ℹ️ Migration Already Completed')
        .setDescription('Stats have already been migrated from existing data.')
        .addFields(
          { name: 'Status', value: '✅ Complete', inline: true },
          { name: 'User Stats', value: `${status.userStatsCount}+ users`, inline: true }
        );
      
      return interaction.editReply({ embeds: [embed] });
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('🔄 Starting Migration')
      .setDescription('Migrating existing images to populate user statistics...\nThis may take a few minutes for large galleries.');
    
    await interaction.editReply({ embeds: [embed] });
    
    // Run migration
    await runMigrationSafely();
    
    const successEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅ Migration Completed')
      .setDescription('Successfully migrated existing data to user statistics!')
      .addFields(
        { name: 'Status', value: '✅ Complete', inline: true },
        { name: 'Next Step', value: 'Users can now use /stats commands', inline: true }
      );
    
    await interaction.editReply({ embeds: [successEmbed] });
    
  } catch (error) {
    console.error('Migration command error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('❌ Migration Failed')
      .setDescription('An error occurred during migration. Check console logs for details.');
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function refreshStats(interaction) {
  // Check if user has admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('❌ Access Denied')
      .setDescription('This command requires administrator permissions.');
    
    return interaction.editReply({ embeds: [embed] });
  }
  
  try {
    const embed = new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('🔄 Refreshing Server Statistics')
      .setDescription('Recalculating server-wide statistics...');
    
    await interaction.editReply({ embeds: [embed] });
    
    // Refresh server stats
    const serverStats = await refreshServerStats();
    
    const successEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅ Server Statistics Refreshed')
      .setDescription('Successfully updated server-wide statistics!')
      .addFields(
        { name: 'Total Users', value: `${serverStats.totalUsers}`, inline: true },
        { name: 'Total Images', value: `${serverStats.totalImages.toLocaleString()}`, inline: true },
        { name: 'Last Updated', value: new Date().toLocaleString(), inline: true }
      );
    
    await interaction.editReply({ embeds: [successEmbed] });
    
  } catch (error) {
    console.error('Refresh stats command error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('❌ Refresh Failed')
      .setDescription('An error occurred while refreshing statistics. Check console logs for details.');
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
} 