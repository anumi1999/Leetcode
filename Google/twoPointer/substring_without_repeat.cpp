#include<bits/stdc++.h>

using namespace std;

int main(){
    string s;
    cin >> s;
    unordered_map<char, int> se;
    int i = 0, j = 0, max_len = 0;
    if( s.length() == 0 ){
        cout << 0;
    }else{
        while( j < s.length()){
            if( se.find(s[j]) == se.end() ){
                se[s[j]] = j;
                j++;
            }else{
                max_len = max(max_len, j - i );
                se.remove(i);
                i = se[s[j]] + 1;
                se[s[j]] = j;
                j++;
            }
        }
        cout << max_len;
    }
    return 0;
}