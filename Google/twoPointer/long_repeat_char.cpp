// do it tomorrow

#include<bits/stdc++.h>

using namespace std;

int main(){
    string s;
    int k;
    cin >> s >> k;
    unordered_map<char, int> mp;
    int i = 0, j = 0, max_len = 0, max_freq = 0;
    if( s.length() == 0 ){
        cout << 0;
    }else{
        while( j < s.length() ){
            mp[s[j]] ++;
            max_freq = max(max_freq, mp[s[j]]);
            while( (j - i + 1) - max_freq > k ){
                mp[s[i]] --;
                i ++;
            }
            max_len = max(max_len, j - i + 1);
            j++;
        }
        cout << max_len;
    }
    return 0;
}