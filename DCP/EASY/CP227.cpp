#include<bits/stdc++.h>
using namespace std;

bool isWord(string str , string *st , int n){
    for(int i = 0 ; i < n ; i++ ){
        if( st[i] == str )
            return true;
    }
    return false;
    
}

void findBoggleUtil( char boggle[4][4] , int i , int j , string *str , string *st , int n,  bool &visited[4][4] ){
    visited[i][j] = true;
    str = str + visited[i][j];
    
    if( isWord( str , st , n) ){
        cout << str << endl;
    }
    
} 
void findinBoggle(char boggle[4][4] , string *st[] , int n ){
    bool visited[4][4] = {{false}};
    string str = "";
    for( int i = 0 ; i < 4 ; i++ ){
        for(int j = 0 ; j < 4 ; j++ ){
            findBoggleUtil( boggle , i , j , str , st , n , visited );
        }
    }
}

int main() {
	int n ;
	cin >> n ;
	cout << endl;
	string st[n];
	for( int i = 0 ; i < n ; i++ ){
	    cin >> st[i];
	}
	char boggle[4][4];
	for( int i = 0 ; i < 4 ; i ++ ){
	    for( int j = 0 ; j < 4 ; j++ ){
	        cin >> boggle[i][j];
	    }
	}
	cout << "Words Present are: " << endl;
	findinBoggle(boggle , st , n);
	return 0;
}
