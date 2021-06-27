#include<bits/stdc++.h>
using namespace std;
int main(){
    int n;
    cin >> n;
    string s;
    cin >> s;
    if( n == 0 )
        cout << 0;
    else{
        char start = s[0];
        int cnt = 1;
        string sol = "";
        for( int i = 1 ; i < s.size() ; i++ ){
            if( s[i] == start ){
                cnt++;
            }else{
                if( cnt != 1){
                    string cnt_str = to_string(cnt);
                    cout<<cnt_str<<" ";
                    sol += cnt_str;
                    sol+= start;
                    start = s[i];
                    cnt = 1;
                }else{
                    string cnt_str = to_string(cnt);
                    sol+= start;
                    start = s[i];
                    cnt = 1;
                }
            }
            cout << sol <<" : " << i <<endl;
        }
        string cnt_str = to_string(cnt);
                    cout<<cnt_str<<" ";
                    sol += cnt_str;
                    sol+= start;
        cout << sol;
    }
    return 0;
}
