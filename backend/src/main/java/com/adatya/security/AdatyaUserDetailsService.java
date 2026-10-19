package com.adatya.security;

import com.adatya.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/** Loads accounts by mobile number, which is Adatya's login identifier. */
@Service
public class AdatyaUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public AdatyaUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String mobile) throws UsernameNotFoundException {
        return userRepository.findByMobile(mobile)
                .map(AuthenticatedUser::from)
                .orElseThrow(() -> new UsernameNotFoundException("No account for that mobile number"));
    }
}
