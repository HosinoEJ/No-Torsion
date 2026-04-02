const fs = require('fs');
const path = require('path');
const { translateDetailItems } = require('./textTranslationService');

function getFriendDescriptionKey(name) {
  const normalizedName = String(name || '').trim().toLowerCase();

  if (normalizedName === 'hosinoneko') {
    return 'hosinoneko';
  }

  if (normalizedName === '牧鸢') {
    return 'muyuan';
  }

  if (normalizedName === 'amber') {
    return 'amber';
  }

  return null;
}

// about 页面用到的友链数据目前仍保存在本地 JSON 文件中。
function readFriendsFromJson() {
  let friendsData = { friends: [] };

  try {
    const jsonPath = path.join(__dirname, '../../friends.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    friendsData = JSON.parse(rawData);
  } catch (error) {
    console.error('讀取友鏈出錯：', error);
  }

  return friendsData.friends;
}

function localizeFriendDescriptions(friends, t) {
  return friends.map((friend) => {
    const descriptionKey = getFriendDescriptionKey(friend.name);

    if (!descriptionKey || typeof t !== 'function') {
      return friend;
    }

    const localizedDescription = t(`about.friendDescriptions.${descriptionKey}`);
    return {
      ...friend,
      desc: localizedDescription || friend.desc || ''
    };
  });
}

async function translateFriendDescriptions(friends, targetLanguage) {
  const translatedFriends = friends.map((friend) => ({
    ...friend,
    desc: friend.desc || ''
  }));
  const translatableFriends = translatedFriends.filter((friend) => friend.desc);

  if (translatableFriends.length === 0) {
    return translatedFriends;
  }

  try {
    const translations = await translateDetailItems({
      items: translatableFriends.map((friend, index) => ({
        fieldKey: String(index),
        text: friend.desc
      })),
      targetLanguage
    });

    translatableFriends.forEach((friend, index) => {
      friend.desc = translations[index]?.translatedText || friend.desc;
    });
  } catch (error) {
    console.error('翻譯友鏈描述出錯：', error);
  }

  return translatedFriends;
}

async function loadFriends({ language, t } = {}) {
  const friends = readFriendsFromJson();

  if (language === 'en') {
    return translateFriendDescriptions(friends, 'en');
  }

  return localizeFriendDescriptions(friends, t);
}

module.exports = {
  loadFriends
};
